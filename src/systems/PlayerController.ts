import { InputKey } from '@/constants/InputKey.ts';
import { InputSystem } from '@/systems/InputSystem.ts';
import { clamp } from '@/utils/math.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import type { IDrawable, IUpdatable } from '@entities/interfaces/interfaces.ts';
import { Player } from '@entities/player/Player.ts';

export class PlayerController implements IUpdatable, IDrawable {
    private player: Player;
    private input: InputSystem;
    private bullets: Bullet[] = [];

    private isShooting = false;
    private lastShotTime = 0;
    private shootCoolDown = 500;

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

        this.bullets.forEach(bullet => bullet.update());
        // Удаляем пули, ушедшие за экран
        this.bullets = this.bullets.filter(bullet => !bullet.isDead);
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Рисуем персонажа
        this.player.draw(ctx);
        // Рисуем пули
        this.bullets.forEach(bullet => bullet.draw(ctx));
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
        if (now - this.lastShotTime >= this.shootCoolDown) {
            this.lastShotTime = now;
            this.shoot();
        }
    }

    private shoot(){
        const angle = Math.atan2(
            this.mouseY - this.player.y,
            this.mouseX - this.player.x,
        );
        const bullet = new Bullet(this.player.x, this.player.y, angle);
        this.bullets.push(bullet);
    }
}
