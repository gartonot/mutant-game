import { distance } from '@/utils/math';
import { ENEMY_CONFIGS } from '@entities/enemy/enemyConfigs.ts';
import { EnemyType } from '@entities/enemy/EnemyType.ts';
import type { IEnemyConfig, IGameEntity } from '@entities/interfaces';

export class Enemy implements IGameEntity {
    x: number;
    y: number;
    radius = 15;
    speed = 1;
    color = '';
    private targetX = 0;
    private targetY = 0;
    private config: IEnemyConfig;
    private health: number;
    private isDeadFlag: boolean = false;

    // Урон врагов
    public damage: number = 2; // базовый урон
    private lastHitTime: number = 0; // время последнего удара
    private hitCooldown: number = 500; // задержка между ударами вргов

    constructor(x: number, y: number, type: EnemyType = EnemyType.GRUNT) {
        this.x = x;
        this.y = y;

        this.config = ENEMY_CONFIGS[type];
        this.health = this.config.maxHealth;

        // Визуальные отличия врагов
        const style = this.getVisualStyle();
        this.radius = style.radius;
        this.color = style.color;
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
        ctx.fillStyle = this.color;
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
    public receiveDamage(amount: number, hitAngle?: number, pushBackDistance: number = 10) {
        this.health -= amount;

        // Отталкивание при попадании, если передан угол
        if (hitAngle !== undefined) {
            this.x += Math.cos(hitAngle) * pushBackDistance;
            this.y += Math.sin(hitAngle) * pushBackDistance;
        }

        if (this.health <= 0) {
            this.die();
        }
    }

    private die(): void {
        this.isDeadFlag = true;
    }

    private getVisualStyle() {
        switch (this.config.type) {
            case 'grunt':
                return { color: '#3d361a', radius: 15 };
            case 'tank':
                return { color: '#093908', radius: 25 };
            case 'boss':
                return { color: '#d22e2e', radius: 40 };
            default:
                return { color: '#3d361a', radius: 15 };
        }
    }

    canDamage(): boolean {
        const now = performance.now();
        if (now - this.lastHitTime > this.hitCooldown) {
            this.lastHitTime = now;
            return true;
        }
        return false;
    }
}

