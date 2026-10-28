import { Beam } from '@/entities/bullet/Beam';
import type { Bullet } from '@/entities/bullet/Bullet';
import type { WeaponId, CharacterId } from '@/gameplay/ids';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import type { WeaponDefinition } from '@/gameplay/weapons';
import { WeaponState } from '@/gameplay/WeaponState';
import { DUAL_WEAPON_OFFSET, muzzlePosition } from '@/rendering/WeaponGeometry';

import type { IWeapon } from './IWeapon';
import { createProjectile } from './ProjectileFactory';
class ConfiguredWeapon implements IWeapon {
    readonly state: WeaponState;
    readonly id: WeaponId;
    readonly name: string;
    chargeProgress = 0;
    get chargeDurationMs(): number { return (this.definition.chargeMs ?? 0) / (this.attackSpeed * this.pickupSpeed); }
    get isCharging(): boolean { return this.chargeDurationMs > 0 && this.started !== null && this.state.hasAmmo; }
    private started: number | null = null;
    private secondShot = false;
    private laser: Beam | null = null;
    private dualWeaponsActive = false;
    private secondLaser: Beam | null = null;
    private laserUntil = -Infinity;
    private lastLaserTime = -Infinity;
    private pickupDamage = 1;
    private pickupSpeed = 1;
    constructor(private readonly definition: WeaponDefinition, private readonly damageMultiplier: number, private readonly attackSpeed: number, private readonly character: CharacterId | undefined, private readonly explosionRadius: number) {
        this.id = definition.id; this.name = definition.name;
        this.state = new WeaponState(definition.ammo, definition.shotIntervalMs / attackSpeed);
    }
    setPickupModifiers(damage: number, attackSpeed: number, now: number): void {
        if (!Number.isFinite(damage) || damage <= 0 || !Number.isFinite(attackSpeed) || attackSpeed <= 0) throw new Error('Invalid pickup modifiers');
        if (this.started !== null && attackSpeed !== this.pickupSpeed) {
            this.started = now - (now - this.started) * this.pickupSpeed / attackSpeed;
        }
        this.state.setCadenceMultiplier(attackSpeed, now);
        this.pickupDamage = damage;
        this.pickupSpeed = attackSpeed;
    }
    setDualWeaponsActive(active: boolean): void {
        this.dualWeaponsActive = active;
        if (!active && this.secondLaser) { this.secondLaser.isDead = true; this.secondLaser = null; }
    }
    cursorProgress(now: number): number | null {
        if (this.definition.cursorIndicator === 'hidden') return null;
        if (this.definition.spinUpMs) {
            return this.started !== null && this.chargeProgress < 1 && this.state.ammoRemaining > 0 ? this.chargeProgress : null;
        }
        if (this.secondShot) return null;
        const progress = this.state.cooldownProgress(now);
        return progress < 1 ? progress : null;
    }
    resetTrigger(now: number, preserveProjectiles = false): void {
        this.state.resetCadence();
        if (this.laser && !preserveProjectiles) this.laser.isDead = true;
        this.laser = null;
        if (this.secondLaser && !preserveProjectiles) this.secondLaser.isDead = true;
        this.secondLaser = null;
        this.started = null; this.chargeProgress = 0;
        if (this.secondShot) { this.secondShot = false; this.state.delay(now); }
    }
    tryFire(now: number, x: number, y: number, angle: number,
        onVisualEffect?: (x: number, y: number, angle: number) => void, triggerHeld = true): Bullet[] | null {
        const d = this.definition;
        const previousLaser = this.laser, previousSecondLaser = this.secondLaser;
        const secondX = x - Math.sin(angle) * DUAL_WEAPON_OFFSET;
        const secondY = y + Math.cos(angle) * DUAL_WEAPON_OFFSET;
        if (d.projectile === 'laser') {
            if (!triggerHeld) { this.resetTrigger(now); return null; }
            if (this.laser && now + 1e-7 < this.state.nextShotAt && !this.laser.isDead) {
                const muzzle = muzzlePosition(this.id, x, y, angle, this.character);
                this.laser.aim(muzzle.x, muzzle.y, angle);
                if (this.secondLaser) {
                    const secondMuzzle = muzzlePosition(this.id, secondX, secondY, angle, this.character);
                    this.secondLaser.aim(secondMuzzle.x, secondMuzzle.y, angle);
                }
                return null;
            }
            // Several paid pulses may be due in one simulation tick. Each must
            // reach collision detection before the next tick replaces the beam.
            if (this.laser && this.lastLaserTime !== now) this.laser.isDead = true;
            if (this.secondLaser && this.lastLaserTime !== now) this.secondLaser.isDead = true;
            this.laser = null;
            this.secondLaser = null;
        }
        if (!triggerHeld) { this.started = null; this.chargeProgress = 0; if (!this.secondShot) { this.state.resetCadence(); return null; } }
        // Spin-up begins on trigger press, even during the last shot's short cadence interval.
        if (d.spinUpMs && triggerHeld && this.state.ammoRemaining > 0) {
            this.started ??= now;
            this.chargeProgress = Math.min(1, (now - this.started) / (d.spinUpMs / (this.attackSpeed * this.pickupSpeed)));
            if (this.chargeProgress < 1) { this.state.resetCadence(); return null; }
        }
        if (!this.state.hasAmmo) this.state.resetCadence();
        if (!this.state.canShoot(now)) return null;
        const charge = this.chargeDurationMs;
        if (charge && triggerHeld) {
            this.started ??= now;
            this.chargeProgress = Math.min(1, (now - this.started) / charge);
            if (this.chargeProgress < 1) { this.state.resetCadence(); return null; }
        }
        const muzzle = muzzlePosition(this.id, x, y, angle, this.character);
        const muzzles = [muzzle];
        if (this.dualWeaponsActive) muzzles.push(muzzlePosition(this.id, secondX, secondY, angle, this.character));
        // Construct every projectile independently: beams and special weapons own mutable hit/sweep state.
        const bullets = muzzles.flatMap(origin => d.pellets.map(pellet => createProjectile(d, origin.x, origin.y, angle + pellet.angleOffset,
            d.damage * pellet.damageMultiplier * this.damageMultiplier * this.pickupDamage, this.damageMultiplier * this.pickupDamage, this.explosionRadius)));
        if (d.projectile === 'laser') {
            this.laser = bullets[0] as Beam;
            this.laser.lifetimeMs = this.state.shotIntervalMs + 1000 / 60;
            // Preserve the final sweep across an ammo-pulse boundary.
            if (previousLaser && now - this.laserUntil <= 1000 / 60 + .01) this.laser.inheritSweep(previousLaser);
            if (this.dualWeaponsActive) {
                this.secondLaser = bullets[d.pellets.length] as Beam;
                this.secondLaser.lifetimeMs = this.laser.lifetimeMs;
                if (previousSecondLaser && now - this.laserUntil <= 1000 / 60 + .01) this.secondLaser.inheritSweep(previousSecondLaser);
            }
            this.lastLaserTime = now;
        }
        const firstInPair = !!d.burstGapMs && !this.secondShot;
        this.state.consumeShot(now, firstInPair ? d.burstGapMs! / (this.attackSpeed * this.pickupSpeed) : this.state.shotIntervalMs);
        if (d.projectile === 'laser') this.laserUntil = this.state.nextShotAt;
        this.secondShot = firstInPair && this.state.ammoRemaining > 0;
        if (d.chargeMs) { this.started = null; this.chargeProgress = 0; }
        if (d.projectile !== 'flame' && d.projectile !== 'laser' && d.projectile !== 'plasma')
            for (const origin of muzzles) onVisualEffect?.(origin.x, origin.y, angle);
        return bullets;
    }
}
export function createWeapon(id: WeaponId, damageMultiplier = 1, attackSpeed = 1, character?: CharacterId, explosionRadius = 1, initialAmmoMultiplier = 1, initialAmmo?: number): IWeapon {
    if (!Number.isFinite(damageMultiplier) || damageMultiplier < 0 || !Number.isFinite(attackSpeed) || attackSpeed <= 0 ||
        !Number.isFinite(explosionRadius) || explosionRadius <= 0 || !Number.isFinite(initialAmmoMultiplier) || initialAmmoMultiplier < 0 ||
        (initialAmmo !== undefined && (!Number.isInteger(initialAmmo) || initialAmmo < 0))) {
        throw new Error('Invalid weapon modifiers');
    }
    const definition = Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, id) ? WEAPON_DEFINITIONS[id] : undefined;
    if (!definition) throw new Error(`Unknown weapon: ${id}`);
    const upgradedDefinition = definition.ammo.kind === 'finite'
        ? { ...definition, ammo: { ...definition.ammo, initial: Math.round((initialAmmo ?? definition.ammo.initial) * initialAmmoMultiplier),
            capacity: Math.max(definition.ammo.capacity, Math.round((initialAmmo ?? definition.ammo.initial) * initialAmmoMultiplier)) } }
        : definition;
    return new ConfiguredWeapon(upgradedDefinition, damageMultiplier, attackSpeed, character, explosionRadius);
}


