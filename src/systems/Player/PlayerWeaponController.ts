import type { Bullet } from '@/entities/bullet/Bullet';
import type { IWeapon } from '@/entities/weapon/IWeapon';
import type { AmmoCategory } from '@/gameplay/WeaponLoot';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import { acceptsWeapon, WEAPON_SLOTS } from '@/gameplay/loadout';

export class PlayerWeaponController {
    private bullets: Bullet[] = [];
    private selectedWeaponIndex: number;
    private readonly weapons: (IWeapon | null)[];
    private readonly acquiredCategories = new Set<AmmoCategory>();
    private dualWeaponsActive = false;
    private pickupDamage = 1;
    private pickupAttackSpeed = 1;
    constructor(weapons: readonly (IWeapon | null)[], private readonly now = () => performance.now()) {
        this.weapons = [...weapons];
        for (const weapon of weapons) {
            if (!weapon) continue;
            const category = WEAPON_DEFINITIONS[weapon.id].category;
            if (category !== 'sidearm') this.acquiredCategories.add(category);
        }
        this.selectedWeaponIndex = weapons.findIndex(weapon => weapon !== null);
        if (this.selectedWeaponIndex < 0) throw new Error('No weapons equipped');
    }
    get slots(): readonly (IWeapon | null)[] { return this.weapons; }
    get selectedIndex(): number { return this.selectedWeaponIndex; }
    get selectedWeapon(): IWeapon { return this.weapons[this.selectedWeaponIndex]!; }
    getBullets(): Bullet[] { return this.bullets; }
    get acquiredAmmoCategories(): readonly AmmoCategory[] { return [...this.acquiredCategories]; }
    acquireWeapon(weapon: IWeapon): 'weapon' | 'ammo' | null {
        const category = WEAPON_DEFINITIONS[weapon.id].category;
        if (category === 'sidearm') return null;
        const index = WEAPON_SLOTS.findIndex(slot => acceptsWeapon(slot, weapon.id));
        if (index < 0) throw new Error(`No slot for weapon: ${weapon.id}`);
        while (this.weapons.length < WEAPON_SLOTS.length) this.weapons.push(null);
        const previous = this.weapons[index];
        if (previous) {
            // The first weapon owns its slot for the entire run, even when empty.
            // Drops already on the ground become ordinary ammunition for that slot.
            this.replenishAmmo(category);
            return 'ammo';
        }
        this.weapons[index] = weapon;
        this.acquiredCategories.add(category);
        this.weapons[index]!.setDualWeaponsActive(this.dualWeaponsActive);
        this.weapons[index]!.setPickupModifiers(this.pickupDamage, this.pickupAttackSpeed, this.now());
        return 'weapon';
    }
    replenishAmmo(category: AmmoCategory): void {
        for (const weapon of this.weapons) {
            if (weapon && WEAPON_DEFINITIONS[weapon.id].category === category && Number.isFinite(weapon.state.ammoCapacity))
                weapon.state.addAmmo(Math.ceil(weapon.state.ammoCapacity * .25));
        }
    }
    setPickupModifiers(damage: number, attackSpeed: number): void {
        this.pickupDamage = damage;
        this.pickupAttackSpeed = attackSpeed;
        for (const weapon of this.weapons) weapon?.setPickupModifiers(damage, attackSpeed, this.now());
    }
    setDualWeaponsActive(active: boolean): void {
        this.dualWeaponsActive = active;
        for (const weapon of this.weapons) weapon?.setDualWeaponsActive(active);
    }
    get hasDualWeapons(): boolean { return this.dualWeaponsActive; }
    setBullets(bullets: Bullet[]): void { this.bullets = bullets; }
    switchToWeapon(index: number): void {
        if (Number.isInteger(index) && this.weapons[index]?.state.hasAmmo && index !== this.selectedWeaponIndex) { this.resetTrigger(); this.selectedWeaponIndex = index; }
    }
    cycleWeapon(direction: -1 | 1): void {
        for (let step = 1; step < this.weapons.length; step++) {
            const index = (this.selectedWeaponIndex + direction * step + this.weapons.length) % this.weapons.length;
            if (this.weapons[index]?.state.hasAmmo) { this.switchToWeapon(index); return; }
        }
    }
    resetTrigger(): void { this.selectedWeapon.resetTrigger(this.now()); }
    tryShoot(x: number, y: number, angle: number, onVisualEffect?: (x: number, y: number, angle: number) => void, triggerHeld = true): Bullet[] | null {
        const fired = this.selectedWeapon.tryFire(this.now(), x, y, angle, onVisualEffect, triggerHeld);
        if (fired) this.bullets.push(...fired);
        if (!this.selectedWeapon.state.hasAmmo && this.weapons.filter(weapon => weapon && weapon.id !== 'pistol').length === 1) {
            const pistolIndex = this.weapons.findIndex(weapon => weapon?.id === 'pistol');
            if (pistolIndex >= 0) {
                // The last laser pulse must still reach collision detection after switching.
                this.selectedWeapon.resetTrigger(this.now(), true);
                this.selectedWeaponIndex = pistolIndex;
            }
        }
        return fired;
    }
    canShoot(): boolean { return this.selectedWeapon.state.canShoot(this.now()); }
    getCursorProgress(): number | null { return this.selectedWeapon.cursorProgress(this.now()); }
}
