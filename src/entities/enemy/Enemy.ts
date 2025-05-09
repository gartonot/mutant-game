import { distance } from '@/utils/math';
import { ENEMY_CONFIGS } from '@entities/enemy/enemyConfigs.ts';
import type { IEnemyConfig, IGameEntity } from '@entities/interfaces';

export class Enemy implements IGameEntity {
    x: number;
    y: number;
    radius = 15;
    speed = 2;
    private targetX = 0;
    private targetY = 0;
    private config: IEnemyConfig;
    private health: number;
    private isDeadFlag: boolean = false;

    constructor(x: number, y: number, type: string = 'grunt') {
        this.x = x;
        this.y = y;

        this.config = ENEMY_CONFIGS[type];
        this.health = this.config.maxHealth;
    }

    get isDead(): boolean {
        return this.isDeadFlag;
    }

    update() {
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    setTarget(x: number, y: number) {
        this.targetX = x;
        this.targetY = y;
    }

    // Проверяем столкновение
    checkCollision(bulletX: number, bulletY: number, bulletRadius: number) {
        return distance(this.x, this.y, bulletX, bulletY) < this.radius + bulletRadius;
    }


    // Получение урона
    public receiveDamage(amount: number): void {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    private die(): void {
        this.isDeadFlag = true;
    }
}

