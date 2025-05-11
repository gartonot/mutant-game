import { InputSystem } from '@/systems/InputSystem.ts';
import { PlayerMovementController } from '@/systems/Player/PlayerMovementController.ts';
import { PlayerWeaponController } from '@/systems/Player/PlayerWeaponController.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IGameEntity } from '@entities/interfaces';
import { Player } from '@entities/player/Player.ts';

export class PlayerController implements IGameEntity {
    private player: Player;
    private movementController: PlayerMovementController;
    private weaponController = new PlayerWeaponController();

    private isShooting = false;
    private mouseX = 0;
    private mouseY = 0;

    constructor(player: Player, input: InputSystem) {
        this.player = player;
        this.movementController = new PlayerMovementController(player, input);

        window.addEventListener('mousedown', () => this.isShooting = true);
        window.addEventListener('mouseup', () => this.isShooting = false);
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
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
                this.weaponController.registerMiss();
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
        this.weaponController.registerHit();
    }

    private handleShooting() {
        if (!this.isShooting) return;

        const angle = Math.atan2(this.mouseY - this.player.y, this.mouseX - this.player.x);
        this.weaponController.tryShoot(this.player.x, this.player.y, angle);
    }
}
