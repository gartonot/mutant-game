import type { Bullet } from '@/entities/bullet/Bullet';
import type { IWeapon } from '@/entities/weapon/IWeapon';

export class PlayerWeaponController {
    private bullets: Bullet[] = [];
    private selectedWeaponIndex: number;
    constructor(private readonly weapons: readonly (IWeapon | null)[], private readonly now = () => performance.now()) {
        this.selectedWeaponIndex = weapons.findIndex(weapon => weapon !== null);
        if (this.selectedWeaponIndex < 0) throw new Error('No weapons equipped');
    }
    get slots(): readonly (IWeapon | null)[] { return this.weapons; }
    get selectedIndex(): number { return this.selectedWeaponIndex; }
    get selectedWeapon(): IWeapon { return this.weapons[this.selectedWeaponIndex]!; }
    getBullets(): Bullet[] { return this.bullets; }
    setBullets(bullets: Bullet[]): void { this.bullets = bullets; }
    switchToWeapon(index: number): void {
        if (Number.isInteger(index) && this.weapons[index] && index !== this.selectedWeaponIndex) { this.resetTrigger(); this.selectedWeaponIndex = index; }
    }
    cycleWeapon(direction: -1 | 1): void {
        for (let step = 1; step < this.weapons.length; step++) {
            const index = (this.selectedWeaponIndex + direction * step + this.weapons.length) % this.weapons.length;
            if (this.weapons[index]) { this.switchToWeapon(index); return; }
        }
    }
    resetTrigger(): void { this.selectedWeapon.resetTrigger(this.now()); }
    tryShoot(x: number, y: number, angle: number, onVisualEffect?: (x: number, y: number, angle: number) => void, triggerHeld = true): Bullet[] | null {
        const fired = this.selectedWeapon.tryFire(this.now(), x, y, angle, onVisualEffect, triggerHeld);
        if (fired) this.bullets.push(...fired);
        return fired;
    }
    canShoot(): boolean { return this.selectedWeapon.state.canShoot(this.now()); }
    getCursorProgress(): number | null { return this.selectedWeapon.cursorProgress(this.now()); }
}
