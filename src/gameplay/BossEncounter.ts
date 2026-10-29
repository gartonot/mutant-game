import type { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';
import { ENEMY_MOVEMENT_SCALE } from '@/entities/enemy/enemyConfigs';
import { drawBossHUD } from '@/ui/BossHUD';

export interface BossPlayer { x: number; y: number; radius: number; abilityInvisible?: boolean }
export interface BossCallbacks {
    damagePlayer(amount: number): void;
    pullPlayer(x: number, y: number, lockMs: number): void;
    stampGround?(x: number, y: number, radius: number, kind: 'crater' | 'hole' | 'blast'): void;
}
export interface BossHUDState { name: string; health: number; maxHealth: number; ageMs: number; dying: boolean }
type Phase = 'entry' | 'chase' | 'windup' | 'roar' | 'pull' | 'burrow' | 'dying';
interface Ring { x: number; y: number; radius: number; previous: number; max: number; damage: number; hit: boolean; color: string }
interface Ground { x: number; y: number; radius: number; age: number; kind: 'crater' | 'hole' | 'blast' }
const NAMES: Record<string, string> = { boss: 'Мозговорот', steroid: 'Стеройдант', tentacle: 'Щупасдец', worm: 'Чрево' };

// Small reusable textures: no gradients, canvases or particle objects allocated per frame.
const effectTextures = new Map<string, HTMLCanvasElement>();
function effectTexture(kind: string): HTMLCanvasElement | null {
    const cached = effectTextures.get(kind);
    if (cached) return cached;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 124);
    if (kind.startsWith('wave:')) {
        const color = kind.slice(5);
        gradient.addColorStop(0, 'transparent'); gradient.addColorStop(.71, 'transparent');
        gradient.addColorStop(.84, color + '08'); gradient.addColorStop(.94, color + '72');
        gradient.addColorStop(.975, color + 'd8'); gradient.addColorStop(1, color + '00');
    } else if (kind === 'puff') {
        gradient.addColorStop(0, '#fffddfe8'); gradient.addColorStop(.16, '#e3efa5cf');
        gradient.addColorStop(.45, '#a3bf6378'); gradient.addColorStop(.75, '#6c81452c'); gradient.addColorStop(1, '#52633100');
    } else {
        gradient.addColorStop(0, kind === 'blast' ? '#26351ab0' : '#080c0af5');
        gradient.addColorStop(.52, kind === 'hole' ? '#0c100ef5' : '#1d211bdc');
        gradient.addColorStop(.7, kind === 'blast' ? '#49622b96' : '#555443b8');
        gradient.addColorStop(.82, '#4b493b56'); gradient.addColorStop(1, '#353a2600');
    }
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
    if (kind === 'crater' || kind === 'hole') {
        for (let i = 0; i < 15; i++) {
            const angle = i * Math.PI * 2 / 15 + .16 * Math.sin(i * 7);
            const radius = 83 + Math.sin(i * 13) * 9;
            ctx.save(); ctx.translate(128, 128); ctx.rotate(angle);
            // Broken outer fissures and irregular rim fragments anchor the opening to the floor.
            ctx.strokeStyle = '#111811b8'; ctx.lineWidth = 2.2; ctx.beginPath();
            ctx.moveTo(radius - 3, 0); ctx.lineTo(radius + 15, i % 2 ? -5 : 4); ctx.lineTo(120, 2); ctx.stroke();
            ctx.fillStyle = i % 3 ? '#65624d' : '#3c4235'; ctx.strokeStyle = '#222b21'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(radius - 10, -7); ctx.lineTo(radius + 5, -9); ctx.lineTo(radius + 10, 3);
            ctx.lineTo(radius - 2, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#b2a37b65'; ctx.beginPath(); ctx.moveTo(radius - 8, -6); ctx.lineTo(radius + 4, -8); ctx.stroke();
            ctx.restore();
        }
    }
    effectTextures.set(kind, canvas); return canvas;
}

/** All timers run on simulation time. A dead boss retains its slot until its death sequence finishes. */
export class BossEncounter {
    private enemy: Enemy | null = null;
    private phase: Phase = 'entry';
    private timer = 0;
    private age = 0;
    private cooldown = 0;
    private waves = 0;
    private entryStart = { x: 0, y: 0 };
    private anchor = { x: 0, y: 0 };
    private aim = { x: 0, y: 0 };
    private rings: Ring[] = [];
    private ground: Ground[] = [];
    private bursts: { x: number; y: number; radius: number; age: number }[] = [];
    private captured = false;
    constructor(private random: () => number = Math.random) {}
    get occupied(): boolean { return this.enemy !== null; }
    get hudState(): BossHUDState | null {
        return this.enemy ? { name: NAMES[this.enemy.type] ?? 'Босс', health: this.enemy.currentHealth,
            maxHealth: this.enemy.maxHealth, ageMs: this.age, dying: this.phase === 'dying' } : null;
    }
    registerBoss(enemy: Enemy): void {
        if (this.enemy) throw new Error('A boss encounter is already active');
        this.enemy = enemy; this.age = 0; this.timer = 2000; this.phase = 'entry'; this.cooldown = 1500;
        enemy.setMaxHealth(({ boss: 160, steroid: 210, tentacle: 240, worm: 260 } as Record<string, number>)[enemy.type] ?? enemy.maxHealth);
        this.entryStart = { x: enemy.x, y: enemy.y }; this.anchor = { ...this.entryStart };
        enemy.movementLocked = true; enemy.contactDisabled = true; enemy.invulnerable = true; enemy.targetable = true;
    }
    reset(): void {
        if (this.enemy) { this.enemy.movementLocked = false; this.enemy.contactDisabled = false; this.enemy.invulnerable = false; this.enemy.targetable = true; this.enemy.renderScale = 1; }
        this.enemy = null; this.rings = []; this.ground = []; this.bursts = []; this.captured = false;
    }
    private mark(x: number, y: number, radius: number, kind: Ground['kind'], callbacks: BossCallbacks): void {
        this.ground.push({ x, y, radius, age: 0, kind });
        if (this.ground.length > 24) this.ground.shift();
        callbacks.stampGround?.(x, y, radius, kind);
    }
    private ring(enemy: Enemy, max: number, damage: number, color = '#f4e4cc'): void {
        this.rings.push({ x: enemy.x, y: enemy.y, radius: enemy.radius * .5, previous: 0, max, damage, hit: false, color });
    }
    private relocate(enemy: Enemy, arena: { width: number; height: number }, player: BossPlayer): void {
        const margin = enemy.radius + 45;
        let x = arena.width / 2, y = arena.height / 2;
        for (let i = 0; i < 8; i++) {
            x = margin + this.random() * Math.max(0, arena.width - margin * 2);
            y = margin + this.random() * Math.max(0, arena.height - margin * 2);
            if (Math.hypot(x - player.x, y - player.y) > 180) break;
        }
        enemy.x = x; enemy.y = y; this.anchor = { x, y };
    }
    update(deltaMs: number, player: BossPlayer, arena: { width: number; height: number }, callbacks: BossCallbacks): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        // Bounded substeps prevent a stalled frame from skipping an entire damaging wave.
        let left = deltaMs;
        while (left > 0) { const step = Math.min(50, left); this.step(step, player, arena, callbacks); left -= step; }
    }
    private step(dt: number, player: BossPlayer, arena: { width: number; height: number }, callbacks: BossCallbacks): void {
        for (const burst of this.bursts) burst.age += dt;
        this.bursts = this.bursts.filter(burst => burst.age < 650);
        for (const mark of this.ground) mark.age += dt;
        for (const ring of this.rings) {
            ring.previous = ring.radius; ring.radius = Math.min(ring.max, ring.radius + dt * .42);
            const distance = Math.hypot(player.x - ring.x, player.y - ring.y);
            if (!ring.hit && distance + player.radius >= ring.previous - 9 && distance - player.radius <= ring.radius + 9) {
                if (ring.damage > 0) callbacks.damagePlayer(ring.damage);
                ring.hit = true;
            }
        }
        this.rings = this.rings.filter(ring => ring.radius < ring.max);
        const enemy = this.enemy;
        if (!enemy) return;
        this.age += dt; this.timer -= dt;
        if (enemy.isDead && this.phase !== 'dying') {
            this.phase = 'dying'; this.timer = enemy.type === EnemyType.WORM ? 650 : 1250;
            enemy.contactDisabled = true; enemy.movementLocked = true; enemy.visualLift = 0; this.captured = false;
        }
        if (this.phase === 'dying') {
            enemy.renderScale = enemy.type === EnemyType.WORM ? Math.max(.05, this.timer / 650) : 1 + .45 * (1 - Math.max(0, this.timer) / 1250);
            if (this.timer <= 0) {
                if (enemy.type !== EnemyType.WORM) {
                    const radius = enemy.radius * 2.7;
                    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) <= radius + player.radius) callbacks.damagePlayer(12);
                    this.mark(enemy.x, enemy.y, radius * .65, 'blast', callbacks);
                    this.bursts.push({ x: enemy.x, y: enemy.y, radius, age: 0 });
                    this.ring(enemy, radius, 0, '#a3d86e');
                }
                enemy.renderScale = 1; this.enemy = null;
            }
            return;
        }
        if (this.phase === 'entry') {
            enemy.faceTarget();
            const progress = Math.min(1, this.age / 2000);
            if (enemy.type === EnemyType.WORM) {
                if (this.age === dt) { this.relocate(enemy, arena, player); this.mark(enemy.x, enemy.y, enemy.radius, 'hole', callbacks); }
                enemy.renderScale = Math.max(.05, progress);
            } else {
                const x = Math.max(enemy.radius + 25, Math.min(arena.width - enemy.radius - 25, this.entryStart.x));
                const y = Math.max(enemy.radius + 25, Math.min(arena.height - enemy.radius - 25, this.entryStart.y));
                enemy.x = this.entryStart.x + (x - this.entryStart.x) * progress;
                enemy.y = this.entryStart.y + (y - this.entryStart.y) * progress;
            }
            if (this.timer <= 0) { this.phase = 'chase'; enemy.invulnerable = false; enemy.movementLocked = false; enemy.contactDisabled = false; enemy.renderScale = 1; }
            return;
        }
        const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        const unableToTarget = !!player.abilityInvisible || enemy.isFeared;
        if (unableToTarget && (this.phase === 'windup' || this.phase === 'pull' || (enemy.isFeared && this.phase === 'roar'))) {
            this.phase = 'chase'; this.cooldown = 800; this.captured = false;
            enemy.movementLocked = false; enemy.contactDisabled = false; enemy.renderScale = 1; enemy.visualLift = 0;
        }
        if (this.phase === 'burrow') {
            enemy.renderScale = Math.max(.05, Math.min(1, this.timer / 650));
            if (this.timer <= 0) {
                this.relocate(enemy, arena, player); this.mark(enemy.x, enemy.y, enemy.radius, 'hole', callbacks);
                this.phase = 'entry'; this.timer = 2000; this.age = 0; enemy.targetable = true;
                // Entry does not relocate a second time: starts just above the first substep.
                this.age = .001;
            }
            return;
        }
        if (this.phase === 'pull') {
            if (this.captured) this.aim = { x: player.x, y: player.y };
            if (this.captured && distance > enemy.radius + player.radius + 9) {
                const step = Math.min(distance - enemy.radius - player.radius - 8, dt * .3);
                callbacks.pullPlayer(player.x + (enemy.x - player.x) / distance * step,
                    player.y + (enemy.y - player.y) / distance * step, 100);
            }
            if (this.timer <= 0 || distance <= enemy.radius + player.radius + 10) {
                this.phase = 'chase'; this.cooldown = 4300; this.captured = false;
                enemy.movementLocked = false; enemy.contactDisabled = false;
            }
            return;
        }
        if (this.phase === 'roar') {
            enemy.renderScale = 1 + Math.sin(this.age * .025) * .045;
            while (this.timer <= 0 && this.waves > 0) {
                this.ring(enemy, enemy.type === EnemyType.WORM ? 225 : 265, 4); this.waves--; this.timer += 260;
            }
            if (!this.waves && this.timer <= 0) {
                if (enemy.type === EnemyType.WORM) { this.phase = 'burrow'; this.timer = 950; enemy.invulnerable = true; enemy.targetable = false; }
                else { this.phase = 'chase'; this.cooldown = 3000; enemy.movementLocked = false; enemy.contactDisabled = false; enemy.renderScale = 1; }
            }
            return;
        }
        if (this.phase === 'windup') {
            enemy.renderScale = 1 + .075 * Math.sin(Math.min(1, 1 - this.timer / 800) * Math.PI);
            enemy.visualLift = enemy.type === EnemyType.STEROID ? Math.sin(Math.max(0, 1 - this.timer / 650) * Math.PI) * 14 : 0;
            if (this.timer > 0) return;
            enemy.visualLift = 0; enemy.renderScale = 1;
            if (enemy.type === EnemyType.STEROID) {
                const radius = 104;
                if (Math.hypot(player.x - this.aim.x, player.y - this.aim.y) <= radius + player.radius) callbacks.damagePlayer(9);
                this.mark(this.aim.x, this.aim.y, radius * .65, 'crater', callbacks);
                this.rings.push({ ...this.aim, radius: 5, previous: 0, max: radius, damage: 0, hit: true, color: '#e8be83' });
                this.phase = 'chase'; this.cooldown = 2400; enemy.movementLocked = false; enemy.contactDisabled = false;
            } else if (enemy.type === EnemyType.TENTACLE) {
                // Aimed capture can be sidestepped during the warning; no unavoidable targeted root.
                const ax = this.aim.x - enemy.x, ay = this.aim.y - enemy.y;
                const len = Math.hypot(ax, ay) || 1;
                const projection = ((player.x - enemy.x) * ax + (player.y - enemy.y) * ay) / len;
                const cross = Math.abs((player.x - enemy.x) * ay - (player.y - enemy.y) * ax) / len;
                this.captured = projection > 0 && projection < 350 && cross < player.radius + 23;
                if (this.captured) callbacks.damagePlayer(4);
                this.phase = 'pull'; this.timer = this.captured ? 1200 : 250;
            } else { this.phase = 'roar'; this.waves = 3; this.timer = 0; }
            return;
        }
        this.cooldown -= dt;
        if (enemy.isFeared) enemy.movementLocked = false;
        if (unableToTarget) return;
        if (enemy.type === EnemyType.WORM) {
            enemy.faceTarget();
            enemy.movementLocked = true;
            // The head extends from its persistent hole; the body is drawn between them.
            if (distance > 5.5 * player.radius * 2) {
                const travel = Math.min(distance, dt * .075 * ENEMY_MOVEMENT_SCALE);
                enemy.x += (player.x - enemy.x) / distance * travel; enemy.y += (player.y - enemy.y) / distance * travel;
            }
        }
        const trigger = enemy.type === EnemyType.STEROID ? 155 : enemy.type === EnemyType.TENTACLE ? 340 : enemy.type === EnemyType.WORM ? 5.5 * player.radius * 2 : 250;
        if (this.cooldown <= 0 && distance <= trigger) {
            enemy.faceTarget();
            this.phase = 'windup'; this.timer = enemy.type === EnemyType.TENTACLE ? 800 : 650;
            this.aim = { x: player.x, y: player.y }; enemy.movementLocked = true; enemy.contactDisabled = true;
        }
    }
    drawGround(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        for (const mark of this.ground) {
            const texture = effectTexture(mark.kind);
            if (texture) {
                ctx.save(); ctx.translate(mark.x, mark.y); ctx.rotate(.2); ctx.globalAlpha = .88;
                ctx.drawImage(texture, -mark.radius * 1.25, -mark.radius * .88, mark.radius * 2.5, mark.radius * 1.76); ctx.restore();
            }
        }
        ctx.restore();
    }
    drawWorld(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        const enemy = this.enemy;
        if (enemy) {
            if (enemy.type === EnemyType.WORM && this.phase !== 'entry') {
                const length = Math.hypot(enemy.x - this.anchor.x, enemy.y - this.anchor.y);
                const count = Math.min(45, Math.max(1, Math.ceil(length / 17)));
                const angle = Math.atan2(enemy.y - this.anchor.y, enemy.x - this.anchor.x);
                for (let i = 0; i < count; i++) {
                    const t = i / count, pulse = Math.sin(t * 12 - this.age * .006) * 3;
                    ctx.save(); ctx.translate(this.anchor.x + (enemy.x - this.anchor.x) * t,
                        this.anchor.y + (enemy.y - this.anchor.y) * t); ctx.rotate(angle);
                    ctx.fillStyle = i % 2 ? '#754b42' : '#65443c'; ctx.strokeStyle = '#342b24'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.ellipse(0, 0, 20, enemy.radius * (.52 + t * .13) + pulse, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.strokeStyle = '#ad7060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-3, -3, 8, enemy.radius * .4, 0, -1.3, 1.3); ctx.stroke();
                    ctx.restore();
                }
                // Draw head again over the extending body.
                if (!enemy.isDead) enemy.draw(ctx);
            }
            if (this.phase === 'dying') enemy.draw(ctx);
            if (this.phase === 'windup' || this.phase === 'dying') {
                ctx.strokeStyle = this.phase === 'dying' ? '#ffc66b' : '#fca76b'; ctx.lineWidth = 2;
                ctx.globalAlpha = .5 + Math.sin(this.age * .015) * .2;
                const radius = this.phase === 'dying' ? enemy.radius * 2.7 : enemy.type === EnemyType.STEROID ? 104 : 225;
                const center = this.phase === 'windup' && enemy.type === EnemyType.STEROID ? this.aim : enemy;
                if (enemy.type === EnemyType.TENTACLE && this.phase === 'windup') {
                    ctx.setLineDash([9, 8]); ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(this.aim.x, this.aim.y); ctx.stroke(); ctx.setLineDash([]);
                } else if (enemy.type !== EnemyType.WORM || this.phase !== 'dying') {
                    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
            if (this.phase === 'pull') {
                ctx.strokeStyle = '#8aaa62'; ctx.lineWidth = 5;
                for (const offset of [-10, 10]) { ctx.beginPath(); ctx.moveTo(enemy.x + offset, enemy.y); ctx.quadraticCurveTo((enemy.x + this.aim.x) / 2 + offset * 3, (enemy.y + this.aim.y) / 2, this.aim.x, this.aim.y); ctx.stroke(); }
            }
        }
        for (const ring of this.rings) {
            const texture = effectTexture('wave:' + ring.color);
            ctx.globalAlpha = Math.min(.9, (1 - ring.radius / ring.max) * 2.6);
            if (texture) ctx.drawImage(texture, ring.x - ring.radius, ring.y - ring.radius, ring.radius * 2, ring.radius * 2);
        }
        const puff = this.bursts.length ? effectTexture('puff') : null;
        if (puff) for (const burst of this.bursts) {
            const progress = burst.age / 650;
            const size = burst.radius * (.4 + Math.sqrt(progress) * 1.1);
            ctx.globalAlpha = (1 - progress) * .85;
            ctx.drawImage(puff, burst.x - size, burst.y - size, size * 2, size * 2);
            for (let i = 0; i < 9; i++) {
                const angle = i * Math.PI * 2 / 9 + .13;
                const travel = size * .62;
                const radius = size * (.2 + .06 * Math.sin(i * 7));
                const x = burst.x + Math.cos(angle) * travel, y = burst.y + Math.sin(angle) * travel;
                ctx.globalAlpha = (1 - progress) * .48;
                ctx.drawImage(puff, x - radius, y - radius, radius * 2, radius * 2);
            }
        }
        ctx.restore();
    }
    drawHUD(ctx: CanvasRenderingContext2D, width: number): void { drawBossHUD(ctx, this.hudState, width); }
}
