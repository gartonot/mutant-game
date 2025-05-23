import { Bullet } from '@/entities/bullet/Bullet';
import type { IWeapon } from '@/entities/weapon/IWeapon';
import { Pistol } from '@/entities/weapon/Pistol';
import { Rifle } from '@/entities/weapon/Rifle';
import { Shotgun } from '@/entities/weapon/Shotgun';

export class PlayerWeaponController {
    private bullets: Bullet[] = [];
    private availableWeapons: IWeapon[] = [
        new Pistol(),
        new Shotgun(),
        new Rifle(),
    ];
    private selectedWeaponIndex = 0;

    // Получение пуль
    public getBullets(): Bullet[] {
        return this.bullets;
    }

    // Установка пуль
    public setBullets(bullets: Bullet[]): void {
        this.bullets = bullets;
    }

    // Выбранное оружие
    public get selectedWeapon(): IWeapon {
        return this.availableWeapons[this.selectedWeaponIndex];
    }

    // Переключение оружия
    public switchToWeapon(index: number): void {
        if (index >= 0 && index < this.availableWeapons.length) {
            this.selectedWeaponIndex = index;
        }
    }

    public tryShoot(
        x: number,
        y: number,
        angle: number,
        onVisualEffect?: (x: number, y: number, angle: number) => void,
    ) {
        const now = performance.now();
        const weapon = this.selectedWeapon;

        if (!weapon.lastShotTime) {
            weapon.lastShotTime = 0;
        }

        if (now - weapon.lastShotTime >= weapon.fireRate) {
            weapon.lastShotTime = now;
            const fired = weapon.fire(x, y, angle, onVisualEffect);
            if (Array.isArray(fired)) {
                this.bullets.push(...fired);
                return fired;
            } else {
                this.bullets.push(fired);
                return [fired];
            }
        }

        return null;
    }

    public drawWeaponUI(ctx: CanvasRenderingContext2D): void {
        const squareSize = 40;
        const padding = 10;
        const offsetX = window.innerWidth - (this.availableWeapons.length * (squareSize + padding));
        const offsetY = window.innerHeight - squareSize - padding;

        // Доступные оружия
        this.availableWeapons.forEach((weapon, index) => {
            const x = offsetX + index * (squareSize + padding);
            const y = offsetY;

            ctx.strokeStyle = index === this.selectedWeaponIndex ? '#f1c40f' : '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, squareSize, squareSize);

            ctx.fillStyle = '#fff';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.name[0], x + squareSize / 2, y + squareSize / 2);
        });
    }

    public canShoot(): boolean {
        const now = performance.now();
        const weapon = this.selectedWeapon;
        weapon.lastShotTime ??= 0;
        return now - weapon.lastShotTime >= weapon.fireRate;
    }

    public getCooldownProgress(): number {
        const now = performance.now();
        const weapon = this.selectedWeapon;
        weapon.lastShotTime ??= 0;
        const progress = (now - weapon.lastShotTime) / weapon.fireRate;
        return Math.min(progress, 1);
    }
}
