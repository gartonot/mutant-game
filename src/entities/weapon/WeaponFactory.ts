import { Beam } from '@/entities/bullet/Beam';
import type { Bullet } from '@/entities/bullet/Bullet';
import type { WeaponId, CharacterId } from '@/gameplay/ids';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import type { WeaponDefinition } from '@/gameplay/weapons';
import { WeaponState } from '@/gameplay/WeaponState';
import { muzzlePosition } from '@/rendering/WeaponGeometry';

import type { IWeapon } from './IWeapon';
import { createProjectile } from './ProjectileFactory';
class ConfiguredWeapon implements IWeapon {
    readonly state: WeaponState;
    readonly id: WeaponId;
    readonly name: string;
    chargeProgress = 0;
    private started: number | null = null;
    private secondShot = false;
    private laser: Beam | null = null;
    private laserUntil = -Infinity;
    constructor(private readonly definition: WeaponDefinition, private readonly damageMultiplier: number, private readonly attackSpeed: number, private readonly character?: CharacterId) {
        this.id = definition.id; this.name = definition.name;
        this.state = new WeaponState(definition.ammo, definition.shotIntervalMs / attackSpeed);
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
    resetTrigger(now: number): void {
        if (this.laser) this.laser.isDead = true;
        this.laser = null;
        this.started = null; this.chargeProgress = 0;
        if (this.secondShot) { this.secondShot = false; this.state.delay(now); }
    }
    tryFire(now: number, x: number, y: number, angle: number,
        onVisualEffect?: (x: number, y: number, angle: number) => void, triggerHeld = true): Bullet[] | null {
        const d = this.definition;
        const previousLaser = this.laser;
        if (d.projectile === 'laser') {
            if (!triggerHeld) { this.resetTrigger(now); return null; }
            if (this.laser && now < this.laserUntil && !this.laser.isDead) {
                const muzzle = muzzlePosition(this.id, x, y, angle, this.character);
                this.laser.aim(muzzle.x, muzzle.y, angle);
                return null;
            }
            if (this.laser) this.laser.isDead = true;
            this.laser = null;
        }
        if (!triggerHeld) { this.started = null; this.chargeProgress = 0; if (!this.secondShot) return null; }
        // Spin-up begins on trigger press, even during the last shot's short cadence interval.
        if (d.spinUpMs && triggerHeld && this.state.ammoRemaining > 0) {
            this.started ??= now;
            this.chargeProgress = Math.min(1, (now - this.started) / (d.spinUpMs / this.attackSpeed));
            if (this.chargeProgress < 1) return null;
        }
        if (!this.state.canShoot(now)) return null;
        const charge = (d.chargeMs ?? 0) / this.attackSpeed;
        if (charge && triggerHeld) {
            this.started ??= now;
            this.chargeProgress = Math.min(1, (now - this.started) / charge);
            if (this.chargeProgress < 1) return null;
        }
        const muzzle = muzzlePosition(this.id, x, y, angle, this.character);
        const bullets = d.pellets.map(pellet => createProjectile(d, muzzle.x, muzzle.y, angle + pellet.angleOffset,
            d.damage * pellet.damageMultiplier * this.damageMultiplier, this.damageMultiplier));
        if (d.projectile === 'laser') {
            this.laser = bullets[0] as Beam;
            this.laser.lifetimeMs = this.state.shotIntervalMs + 1000 / 60;
            // Preserve the final sweep across an ammo-pulse boundary.
            if (previousLaser && now - this.laserUntil <= 1000 / 60 + .01) this.laser.inheritSweep(previousLaser);
            this.laserUntil = now + this.state.shotIntervalMs;
        }
        const firstInPair = !!d.burstGapMs && !this.secondShot;
        this.state.consumeShot(now, firstInPair ? d.burstGapMs! / this.attackSpeed : this.state.shotIntervalMs);
        this.secondShot = firstInPair && this.state.ammoRemaining > 0;
        if (d.chargeMs) { this.started = null; this.chargeProgress = 0; }
        if (d.projectile !== 'flame' && d.projectile !== 'laser' && d.projectile !== 'plasma') onVisualEffect?.(muzzle.x, muzzle.y, angle);
        return bullets;
    }
}
export function createWeapon(id: WeaponId, damageMultiplier = 1, attackSpeed = 1, character?: CharacterId): IWeapon {
    if (!Number.isFinite(damageMultiplier) || damageMultiplier < 0 || !Number.isFinite(attackSpeed) || attackSpeed <= 0) {
        throw new Error('Invalid weapon modifiers');
    }
    const definition = Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, id) ? WEAPON_DEFINITIONS[id] : undefined;
    if (!definition) throw new Error(`Unknown weapon: ${id}`);
    return new ConfiguredWeapon(definition, damageMultiplier, attackSpeed, character);
}


