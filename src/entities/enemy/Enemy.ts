import type { HitEffect } from '@/gameplay/HitEffect';
import { drawEnemyArt } from '@/rendering/EnemyArt';
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
    private facing = 0;
    private gait = 0;
    private lastHitAngle?: number;
    private deathOrigin?: { x: number; y: number; angle: number };

    get deathBurst() {
        if (!this.deathOrigin) return undefined;
        const palette = this.type === EnemyType.TANK
            ? ['#243b17', '#4d702b', '#79a044']
            : ['#630c13', '#a3131d', '#c51d26'];
        return { ...this.deathOrigin, radius: this.radius, palette };
    }

    // Урон врагов
    public damage: number = 2; // базовый урон
    private lastHitTime: number = -Infinity; // время последнего удара
    private hitCooldown: number = 500; // задержка между ударами вргов

    constructor(x: number, y: number, private readonly type: EnemyType = EnemyType.GRUNT) {
        this.x = x;
        this.y = y;
        this.gait = (x * .31 + y * .17) % (Math.PI * 2);

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

    private burnMs = 0;
    private burnDps = 0;
    private slowMs = 0;
    private slowFactor = 1;
    applyEffect(effect?: HitEffect): void {
        if (!effect) return;
        if (effect.burnMs) { this.burnMs = Math.max(this.burnMs, effect.burnMs); this.burnDps = Math.max(this.burnDps, effect.burnDps ?? 0); }
        if (effect.slowMs) { this.slowMs = Math.max(this.slowMs, effect.slowMs); this.slowFactor = Math.min(this.slowFactor, effect.slowFactor ?? 1); }
    }
    update(deltaMs = 1000 / 60) {
        if (this.isDead) return;
        if (this.burnMs > 0) { this.receiveDamage(this.burnDps * Math.min(deltaMs, this.burnMs) / 1000); this.burnMs = Math.max(0, this.burnMs - deltaMs); }
        if (!this.burnMs) this.burnDps = 0;
        const movement = this.slowMs > 0 ? this.slowFactor : 1;
        this.slowMs = Math.max(0, this.slowMs - deltaMs);
        if (!this.slowMs) this.slowFactor = 1;
        if (this.isDead) return;
        const dx = this.targetX - this.x, dy = this.targetY - this.y;
        const length = Math.hypot(dx, dy);
        if (length > 0) {
            this.facing = Math.atan2(dy, dx);
            this.gait += this.speed * movement * .16;
            this.x += dx / length * this.speed * movement;
            this.y += dy / length * this.speed * movement;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        if (!drawEnemyArt(ctx, this.type, this.x, this.y, this.radius, this.facing, this.gait)) {
            ctx.fillStyle = this.burnMs > 0 ? '#ed7135' : this.slowMs > 0 ? '#71cadb' : this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.slowMs > 0) {
            ctx.strokeStyle = '#8ce8f4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.burnMs > 0) {
            ctx.strokeStyle = '#ffad4b';
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 2 + this.gait * .3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 4, angle, angle + .65);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    setTarget(x: number, y: number) {
        this.targetX = x;
        this.targetY = y;
    }

    // Проверяем столкновение
    checkCollision(bulletX: number, bulletY: number, bulletRadius: number) {
        const dx = this.x - bulletX, dy = this.y - bulletY;
        return dx * dx + dy * dy < (this.radius + bulletRadius) ** 2;
    }


    // Получение урона
    public receiveDamage(amount: number, hitAngle?: number, pushBackDistance: number = 10) {
        if (this.isDead) return;
        if (hitAngle !== undefined && Number.isFinite(hitAngle)) this.lastHitAngle = hitAngle;
        this.health -= amount;
        if (this.health <= 0) {
            this.deathOrigin = { x: this.x, y: this.y, angle: this.lastHitAngle ?? this.facing + Math.PI };
        }

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
                return { color: '#3d361a', radius: 25 };
            case 'tank':
                return { color: '#093908', radius: 25 };
            case 'boss':
                return { color: '#d22e2e', radius: 40 };
            default:
                return { color: '#3d361a', radius: 15 };
        }
    }

    canDamage(now: number): boolean {
        if (!this.isDead && now - this.lastHitTime > this.hitCooldown) {
            this.lastHitTime = now;
            return true;
        }
        return false;
    }
}

