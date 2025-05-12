import { InputSystem } from '@/systems/InputSystem.ts';
import { PlayerInputController } from '@/systems/Player/PlayerInputController.ts';
import { PlayerMovementController } from '@/systems/Player/PlayerMovementController.ts';
import { PlayerStatsController } from '@/systems/Player/PlayerStatsController';
import { PlayerWeaponController } from '@/systems/Player/PlayerWeaponController.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IGameEntity } from '@entities/interfaces';
import { Player } from '@entities/player/Player.ts';

export class PlayerController implements IGameEntity {
    private player: Player;
    private movementController: PlayerMovementController;
    private weaponController = new PlayerWeaponController();
    private inputController = new PlayerInputController();
    private statsController = new PlayerStatsController();

    constructor(player: Player, input: InputSystem) {
        this.player = player;
        this.movementController = new PlayerMovementController(player, input);
    }

    update() {
        // Обрабаотчик передвижения
        this.movementController.update();
        // Обработчик выстрела
        this.handleShooting();

        const bullets = this.weaponController.getBullets();
        bullets.forEach(bullet => bullet.update());

        const newBullets = bullets.filter(bullet => {
            if (bullet.isDead) {
                this.statsController.registerMiss();
            }
            return !bullet.isDead;
        });
        this.weaponController.setBullets(newBullets);

    }

    draw(ctx: CanvasRenderingContext2D) {
        // Рисуем персонажа
        this.player.draw(ctx);
        // Рисуем пули
        this.weaponController.getBullets().forEach(bullet => bullet.draw(ctx));
        // Рисуем название текущего оружия
        this.weaponController.drawWeaponUI(ctx);
        // Отрисовка статистики
        this.statsController.drawStats(ctx);
        // Отрисовка курсора
        this.drawCursor(ctx);
    }

    public getBullets() {
        return this.weaponController.getBullets();
    }

    public setBullets(bullets: Bullet[]) {
        this.weaponController.setBullets(bullets);
    }

    public getPlayer() {
        return this.player;
    }

    public switchToWeapon(index: number): void {
        this.weaponController.switchToWeapon(index);
    }

    public registerHit(): void {
        this.statsController.registerHit();
    }

    private handleShooting() {
        if (!this.inputController.getIsShooting()) return;

        const mousePos = this.inputController.getMousePosition();
        const angle = Math.atan2(mousePos.y - this.player.y, mousePos.x - this.player.x);

        const fired = this.weaponController.tryShoot(this.player.x, this.player.y, angle);

        // Регистрируем выстрел
        this.statsController.registerShot(Array.isArray(fired) ? fired.length : 1);
    }

    public registerKill(): void {
        this.statsController.registerKill();
    }

    public getKillCount() {
        return this.statsController.getKillCount();
    }

    private drawCursor(ctx: CanvasRenderingContext2D) {
        const radius = 10;
        const mousePos = this.inputController.getMousePosition();
        const centerX = mousePos.x;
        const centerY = mousePos.y;

        this.drawCursorUI(ctx, radius, centerX, centerY);
        this.drawCooldownUI(ctx, radius, centerX, centerY);
    }

    private drawCursorUI(ctx: CanvasRenderingContext2D, radius: number, centerX: number, centerY: number) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#edd937';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    private drawCooldownUI(ctx: CanvasRenderingContext2D, radius: number, centerX: number, centerY: number) {
        // Получаем прогресс перезарядки
        const progress = this.weaponController.getCooldownProgress();

        if (progress < 1) {
            const outerRadius = radius + 10; // чуть дальше основного курсора
            const startAngle = -Math.PI / 2; // начинается с "12 часов"
            const endAngle = startAngle + (Math.PI * 2 * progress);

            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 6;
            ctx.stroke();
        }
    }
}
