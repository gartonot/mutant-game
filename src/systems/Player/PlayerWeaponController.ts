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
    private lastShotTime = 0;

    private totalShotsFired = 0;
    private totalResolvedShots = 0;
    private totalHits = 0;

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

    public tryShoot(x: number, y: number, angle: number): void {
        const now = Date.now();
        if (now - this.lastShotTime >= this.selectedWeapon.fireRate) {
            this.lastShotTime = now;
            const fired = this.selectedWeapon.fire(x, y, angle);
            this.totalShotsFired += Array.isArray(fired) ? fired.length : 1;
            if (Array.isArray(fired)) {
                this.bullets.push(...fired);
            } else {
                this.bullets.push(fired);
            }
        }
    }

    // Регистрируем попадание
    public registerHit(): void {
        this.totalHits++;
        this.totalResolvedShots++;
    }

    // Регистрируем промах
    public registerMiss(): void {
        this.totalResolvedShots++;
    }

    // Получить меткость
    public getAccuracy(): number {
        if (this.totalResolvedShots === 0) {
            return 100;
        }
        return Math.min(100, Math.round((this.totalHits / this.totalResolvedShots) * 100));
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

        // Параметр меткости
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Меткость: ${this.getAccuracy()}%`, window.innerWidth - 20, window.innerHeight - 80);
    }
}
