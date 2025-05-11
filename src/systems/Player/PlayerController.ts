import { InputSystem } from '@/systems/InputSystem.ts';
import { PlayerInputController } from '@/systems/Player/PlayerInputController.ts';
import { PlayerMovementController } from '@/systems/Player/PlayerMovementController.ts';
import { PlayerWeaponController } from '@/systems/Player/PlayerWeaponController.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IGameEntity } from '@entities/interfaces';
import { Player } from '@entities/player/Player.ts';

export class PlayerController implements IGameEntity {
    private player: Player;
    private movementController: PlayerMovementController;
    private weaponController = new PlayerWeaponController();
    private inputController = new PlayerInputController();

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
        if (!this.inputController.getIsShooting()) return;

        const mousePos = this.inputController.getMousePosition();
        const angle = Math.atan2(mousePos.y - this.player.y, mousePos.x - this.player.x);
        this.weaponController.tryShoot(this.player.x, this.player.y, angle);
    }
}
