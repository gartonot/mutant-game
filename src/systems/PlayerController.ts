import { InputKey } from '@/constants/InputKey.ts';
import { InputSystem } from '@/systems/InputSystem.ts';
import { PlayerWeaponController } from '@/systems/Player/PlayerWeaponController.ts';
import { clamp } from '@/utils/math.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IGameEntity } from '@entities/interfaces';
import { Player } from '@entities/player/Player.ts';

export class PlayerController implements IGameEntity {
    private player: Player;
    private input: InputSystem;
    private weaponController = new PlayerWeaponController();

    private isShooting = false;

    private mouseX = 0;
    private mouseY = 0;

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

    // Передвижение игрока
    private handleMovement() {
        if (this.input.isPressed(InputKey.W)) this.player.y -= this.player.speed;
        if (this.input.isPressed(InputKey.S)) this.player.y += this.player.speed;
        if (this.input.isPressed(InputKey.A)) this.player.x -= this.player.speed;
        if (this.input.isPressed(InputKey.D)) this.player.x += this.player.speed;

        // Запрет выхода на сцену
        const playerRadius = this.player.radius;
        this.player.x = clamp(this.player.x, playerRadius, window.innerWidth - playerRadius);
        this.player.y = clamp(this.player.y, playerRadius, window.innerHeight - playerRadius);
    }

    private handleShooting() {
        if (!this.isShooting) return;

        const angle = Math.atan2(this.mouseY - this.player.y, this.mouseX - this.player.x);
        this.weaponController.tryShoot(this.player.x, this.player.y, angle);
    }
}
