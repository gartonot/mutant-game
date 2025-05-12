import { InputKey } from '@/constants/InputKey';
import { Player } from '@/entities/player/Player';
import { InputSystem } from '@/systems/InputSystem';
import { clamp } from '@/utils/math';
import type { Enemy } from '@entities/enemy/Enemy.ts';

export class PlayerMovementController {
    private player: Player;
    private enemies: Enemy[] = [];
    private input: InputSystem;
    private isMoving = false;

    constructor(player: Player, input: InputSystem) {
        this.player = player;
        this.input = input;
    }

    public update(): void {
        this.handleMovement();
        this.resolvePlayerEnemyCollisions();
    }

    private handleMovement(): void {
        this.isMoving = false;

        if (this.input.isPressed(InputKey.W)) { this.player.y -= this.player.speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.S)) { this.player.y += this.player.speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.A)) { this.player.x -= this.player.speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.D)) { this.player.x += this.player.speed; this.isMoving = true; }

        const playerRadius = this.player.radius;
        this.player.x = clamp(this.player.x, playerRadius, window.innerWidth - playerRadius);
        this.player.y = clamp(this.player.y, playerRadius, window.innerHeight - playerRadius);
    }

    public syncEnemies(enemies: Enemy[]): void {
        this.enemies = enemies;
    }

    private resolvePlayerEnemyCollisions(): void {
        this.enemies.forEach(enemy => {
            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = this.player.radius + enemy.radius;

            if (distance < minDistance) {
                const overlap = minDistance - distance;
                const basePushX = (dx / distance) * overlap;
                const basePushY = (dy / distance) * overlap;

                if (this.isMoving) {
                    // Игрок толкает врага сильнее, но сам немного двигается назад
                    enemy.x += basePushX * 0.7;
                    enemy.y += basePushY * 0.7;
                    this.player.x -= basePushX * 0.3;
                    this.player.y -= basePushY * 0.3;
                } else {
                    // Игрок стоит, враг медленно давит игрока
                    enemy.x += basePushX * 0.3;
                    enemy.y += basePushY * 0.3;
                    this.player.x -= basePushX * 0.7;
                    this.player.y -= basePushY * 0.7;
                }
            }
        });
    }
}
