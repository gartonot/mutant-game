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
    private zigzagPhase = 0;
    private statusAngle = 0;
    private lastHitAngle?: number;
    private deathOrigin?: { x: number; y: number; angle: number };

    get deathBurst() {
        if (!this.deathOrigin) return undefined;
        const palette = this.type === EnemyType.TANK || this.type === EnemyType.BUG
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
        this.zigzagPhase = this.gait;

        this.config = ENEMY_CONFIGS[type];
        this.health = this.config.maxHealth;

        this.radius = this.config.radius;
        this.speed = this.config.speed;
        this.damage = this.config.damageToPlayer;
        this.color = this.config.color;
    }

    get isDead(): boolean {
        return this.isDeadFlag;
    }

    private burnMs = 0;
    private acidMs = 0;
    private acidDps = 0;
    private burnDps = 0;
    private slowMs = 0;
    private slowFactor = 1;
    private fearMs = 0;
    private fearElapsed = 0;
    private fearHeading = 0;
    private fearSourceX = 0;
    private fearSourceY = 0;
    private fearTurn = 1;
    private fearRecoveryMs = 0;
    get isFeared(): boolean { return this.fearMs > 0; }
    applyFear(durationMs: number, sourceX = this.targetX, sourceY = this.targetY): void {
        if (!Number.isFinite(durationMs) || durationMs <= 0) return;
        if (!this.isFeared) {
            this.fearElapsed = 0;
            // Stable variation spreads a pack into individual paths, without per-frame noise.
            const seed = Math.sin(this.x * 12.9898 + this.y * 78.233) * 43758.5453;
            const variation = seed - Math.floor(seed);
            this.fearTurn = variation < .5 ? -1 : 1;
            this.fearHeading = Math.hypot(this.x - sourceX, this.y - sourceY) > .01
                ? Math.atan2(this.y - sourceY, this.x - sourceX) + (variation - .5) * .5
                : variation * Math.PI * 2;
        }
        this.fearSourceX = sourceX;
        this.fearSourceY = sourceY;
        this.fearMs = Math.max(this.fearMs, durationMs);
    }
    private turnTowards(current: number, target: number, limit: number): number {
        const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
        return current + Math.max(-limit, Math.min(limit, difference));
    }
    private flee(deltaMs: number, movement: number): void {
        this.fearElapsed += deltaMs;
        this.fearRecoveryMs = 300;
        let dx = this.x - this.fearSourceX, dy = this.y - this.fearSourceY;
        const length = Math.hypot(dx, dy);
        if (length > .01) { dx /= length; dy /= length; }
        else { dx = Math.cos(this.fearHeading); dy = Math.sin(this.fearHeading); }
        // A gentle, stable bend makes individuals fan out rather than move as a rigid ring.
        const bend = this.fearTurn * .18;
        let steerX = dx * Math.cos(bend) - dy * Math.sin(bend);
        let steerY = dx * Math.sin(bend) + dy * Math.cos(bend);
        const width = typeof window !== 'undefined' ? window.innerWidth : 0;
        const height = typeof window !== 'undefined' ? window.innerHeight : 0;
        const margin = this.radius + 8;
        if (width > margin * 2 && height > margin * 2) {
            const zone = 100;
            const pressure = (distance: number) => Math.max(0, Math.min(1, 1 - distance / zone));
            const left = pressure(this.x - margin), right = pressure(width - margin - this.x);
            const top = pressure(this.y - margin), bottom = pressure(height - margin - this.y);
            const wallX = left - right, wallY = top - bottom;
            // Inward pressure plus a persistent tangential turn guides runners around corners.
            steerX += wallX * 2.6 - wallY * this.fearTurn * 1.3;
            steerY += wallY * 2.6 + wallX * this.fearTurn * 1.3;
        }
        this.fearHeading = this.turnTowards(this.fearHeading, Math.atan2(steerY, steerX), deltaMs * .006);
        this.facing = this.turnTowards(this.facing, this.fearHeading, deltaMs * .014);
        const easeIn = Math.min(1, this.fearElapsed / 180);
        const easeOut = Math.min(1, this.fearMs / 350);
        const step = this.speed * movement * (1 + .75 * easeIn * easeOut);
        this.gait += step * .23;
        const nextX = this.x + Math.cos(this.fearHeading) * step;
        const nextY = this.y + Math.sin(this.fearHeading) * step;
        // Only clamp runners already inside: offscreen spawns must enter without teleporting.
        this.x = width > margin * 2 && this.x >= margin && this.x <= width - margin
            ? Math.max(margin, Math.min(width - margin, nextX)) : nextX;
        this.y = height > margin * 2 && this.y >= margin && this.y <= height - margin
            ? Math.max(margin, Math.min(height - margin, nextY)) : nextY;
    }
    applyEffect(effect?: HitEffect): void {
        if (!effect) return;
        if (effect.acidMs) { this.acidMs = Math.max(this.acidMs, effect.acidMs); this.acidDps = Math.max(this.acidDps, effect.acidDps ?? 0); }
        if (effect.burnMs) {
            this.slowMs = 0;
            this.slowFactor = 1;
            this.burnMs = Math.max(this.burnMs, effect.burnMs);
            this.burnDps = Math.max(this.burnDps, effect.burnDps ?? 0);
        }
        if (effect.slowMs) {
            this.burnMs = 0;
            this.burnDps = 0;
            this.slowMs = Math.max(this.slowMs, effect.slowMs);
            this.slowFactor = Math.min(this.slowFactor, effect.slowFactor ?? 1);
        }
    }
    update(deltaMs = 1000 / 60) {
        if (this.isDead) return;
        const feared = this.isFeared;
        this.fearMs = Math.max(0, this.fearMs - deltaMs);
        const movement = this.slowMs > 0 ? this.slowFactor : this.burnMs > 0 ? 1.35 : 1;
        // Simulation time keeps rings rotating even while the enemy stands still.
        this.statusAngle = (this.statusAngle + deltaMs * .0018) % (Math.PI * 2);
        if (this.burnMs > 0) { this.receiveDamage(this.burnDps * Math.min(deltaMs, this.burnMs) / 1000); this.burnMs = Math.max(0, this.burnMs - deltaMs); }
        if (!this.burnMs) this.burnDps = 0;
        if (this.acidMs > 0) { this.receiveDamage(this.acidDps * Math.min(deltaMs, this.acidMs) / 1000); this.acidMs = Math.max(0, this.acidMs - deltaMs); }
        if (!this.acidMs) this.acidDps = 0;
        this.slowMs = Math.max(0, this.slowMs - deltaMs);
        if (!this.slowMs) this.slowFactor = 1;
        if (this.isDead) return;
        if (feared) { this.flee(deltaMs, movement); return; }
        const dx = this.targetX - this.x, dy = this.targetY - this.y;
        const length = Math.hypot(dx, dy);
        if (length > 0) {
            // Individual, simulation-timed weaving; ease out near the target to avoid orbiting it.
            if (this.type === EnemyType.BUG) {
                this.zigzagPhase = (this.zigzagPhase + deltaMs * Math.PI * 2 / 700) % (Math.PI * 2);
            }
            const weave = this.type === EnemyType.BUG
                ? Math.sin(this.zigzagPhase) * .65 * Math.min(1, length / 60) : 0;
            const direction = Math.atan2(dy, dx) + weave;
            this.facing = this.fearRecoveryMs > 0
                ? this.turnTowards(this.facing, direction, deltaMs * .012) : direction;
            this.fearRecoveryMs = Math.max(0, this.fearRecoveryMs - deltaMs);
            this.gait += this.speed * movement * .16;
            this.x += Math.cos(this.facing) * this.speed * movement;
            this.y += Math.sin(this.facing) * this.speed * movement;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        const tint = this.burnMs > 0 ? 'fire' : this.slowMs > 0 ? 'ice' : undefined;
        if (!drawEnemyArt(ctx, this.type, this.x, this.y, this.radius, this.facing, this.gait, tint)) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            if (tint) {
                ctx.fillStyle = tint === 'ice' ? 'rgba(100, 205, 255, 0.52)' : 'rgba(160, 20, 48, 0.52)';
                ctx.fill();
            }
        }
        if (this.slowMs > 0) {
            ctx.strokeStyle = '#8ce8f4';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4 + this.statusAngle;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 2, angle, angle + .42);
                ctx.stroke();
            }
        }
        if (this.acidMs > 0) {
            ctx.strokeStyle = '#a2f64d'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 6, .3, Math.PI * 1.7); ctx.stroke();
        }
        if (this.burnMs > 0) {
            ctx.strokeStyle = '#ffad4b';
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 2 + this.statusAngle;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 4, angle, angle + .65);
                ctx.stroke();
            }
        }
        if (this.isFeared) {
            // Three restrained wisps trail the actual run direction; no floating emoji or blur.
            ctx.save();
            ctx.translate(this.x, this.y); ctx.rotate(this.fearHeading);
            ctx.globalAlpha *= Math.min(1, this.fearMs / 300) * Math.min(1, this.fearElapsed / 120);
            ctx.lineCap = 'round';
            for (let i = -1; i <= 1; i++) {
                const pulse = Math.sin(this.statusAngle * 3 + i * 2) * 3;
                const y = i * this.radius * .65;
                ctx.strokeStyle = i === 0 ? 'rgba(209, 66, 113, .65)' : 'rgba(181, 119, 222, .65)';
                ctx.lineWidth = i === 0 ? 2.5 : 1.5;
                ctx.beginPath();
                ctx.moveTo(-this.radius * .65, y);
                ctx.quadraticCurveTo(-this.radius - 12, y + pulse, -this.radius - 27 - pulse, y * .8);
                ctx.stroke();
            }
            ctx.restore();
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
        if (this.isDead || !Number.isFinite(amount) || amount < 0) return;
        if (hitAngle !== undefined && Number.isFinite(hitAngle)) this.lastHitAngle = hitAngle;
        const configuredReduction = this.config.damageReduction ?? 0;
        const reduction = Number.isFinite(configuredReduction) ? Math.max(0, Math.min(.8, configuredReduction)) : 0;
        this.health -= amount * (1 - reduction);
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

    canDamage(now: number): boolean {
        if (!this.isDead && !this.isFeared && now - this.lastHitTime > this.hitCooldown) {
            this.lastHitTime = now;
            return true;
        }
        return false;
    }
}
