import { InputKey } from '@/constants/InputKey.ts';
import { InputSystem } from '@/systems/InputSystem.ts';
import { clamp } from '@/utils/math.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IGameEntity } from '@entities/interfaces';
import { Player } from '@entities/player/Player.ts';
import type { IWeapon } from '@entities/weapon/IWeapon.ts';
import { Pistol } from '@entities/weapon/Pistol.ts';
import { Rifle } from '@entities/weapon/Rifle.ts';
import { Shotgun } from '@entities/weapon/Shotgun.ts';

export class PlayerController implements IGameEntity {
    private player: Player;
    private input: InputSystem;
    private bullets: Bullet[] = [];

    private isShooting = false;
    private lastShotTime = 0;

    private mouseX = 0;
    private mouseY = 0;

    // Для счётчика меткости
    private totalShotsFired = 0;
    private totalResolvedShots = 0; // Завершившиеся пули
    private totalHits = 0; // Попадания

    // Выбор оружия
    private availableWeapons: IWeapon[] = [
        new Pistol(),
        new Shotgun(),
        new Rifle(),
    ];
    private selectedWeaponIndex: number = 0;

    constructor(player: Player, input: InputSystem) {
        this.player = player;
        this.input = input;

        window.addEventListener('mousedown', () => this.isShooting = true);
        window.addEventListener('mouseup', () => this.isShooting = false);
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
    }

    update() {
        // Обрабаотчик передвижения
        this.handleMovement();
        // Обработчик выстрела
        this.handleShooting();

        this.bullets.forEach(bullet => bullet.update());
        // Удаляем пули, ушедшие за экран
        this.bullets = this.bullets.filter(bullet => {
            if (bullet.isDead) {
                this.registerMiss();
            }

            return !bullet.isDead;
        });
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Рисуем персонажа
        this.player.draw(ctx);

        // Рисуем пули
        this.bullets.forEach(bullet => bullet.draw(ctx));

        // Рисуем название текущего оружия
        const squareSize = 40;
        const padding = 10;
        const offsetX = window.innerWidth - (this.availableWeapons.length * (squareSize + padding));
        const offsetY = window.innerHeight - squareSize - padding;

        this.availableWeapons.forEach((weapon, index) => {
            const x = offsetX + index * (squareSize + padding);
            const y = offsetY;

            // Рамка
            ctx.strokeStyle = index === this.selectedWeaponIndex ? '#f1c40f' : '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, squareSize, squareSize);

            // Буква внутри квадрата
            ctx.fillStyle = '#fff';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = weapon.name[0]; // Первая буква имени
            ctx.fillText(label, x + squareSize / 2, y + squareSize / 2);
        });

        // Меткость
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Меткость: ${this.getAccuracy()}%`, window.innerWidth - 20, window.innerHeight - 80);
    }

    private get selectedWeapon(): IWeapon {
        return this.availableWeapons[this.selectedWeaponIndex];
    }

    public getBullets() {
        return this.bullets;
    }

    public setBullets(bullets: Bullet[]) {
        this.bullets = bullets;
    }

    public getPlayer() {
        return this.player;
    }

    // Передвижение игрока
    private handleMovement() {
        if (this.input.isPressed(InputKey.W)) this.player.y -= this.player.speed;
        if (this.input.isPressed(InputKey.S)) this.player.y += this.player.speed;
        if (this.input.isPressed(InputKey.A)) this.player.x -= this.player.speed;
        if (this.input.isPressed(InputKey.D)) this.player.x += this.player.speed;

        // Запрет выхода на сцену
        const playerRadius = this.player.radius;
        this.player.x = this.clampBorderScene(
            this.player.x,
            playerRadius,
            window.innerWidth - playerRadius,
        );
        this.player.y = this.clampBorderScene(
            this.player.y,
            playerRadius,
            window.innerHeight - playerRadius,
        );
    }

    private clampBorderScene(currentPosition: number, minPosition: number, maxPosition: number) {
        return clamp(currentPosition, minPosition, maxPosition);
    }

    private handleShooting() {
        if (!this.isShooting) return;

        const now = Date.now();
        if (now - this.lastShotTime >= this.selectedWeapon.fireRate) {
            this.lastShotTime = now;
            this.shoot();
        }
    }

    private shoot(){
        const angle = Math.atan2(
            this.mouseY - this.player.y,
            this.mouseX - this.player.x,
        );
        const fired = this.selectedWeapon.fire(this.player.x, this.player.y, angle);

        // Фиксируем попадаение и увеличиваем счётчик
        this.totalShotsFired += Array.isArray(fired) ? fired.length : 1;

        if (Array.isArray(fired)) {
            this.bullets.push(...fired);
        } else {
            this.bullets.push(fired);
        }
    }

    public switchToWeapon(index: number): void {
        if (index >= 0 && index < this.availableWeapons.length) {
            this.selectedWeaponIndex = index;
        }
    }

    public registerHit(): void {
        this.totalHits++;
        this.totalResolvedShots++;
    }

    public registerMiss(): void {
        this.totalResolvedShots++;
    }

    public getAccuracy(): number {
        if (this.totalResolvedShots === 0) {
            return 100;
        }

        return Math.min(100, Math.round((this.totalHits / this.totalResolvedShots) * 100));
    }
}
