import type { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';
import { ENEMY_CONFIGS } from '@/entities/enemy/enemyConfigs';
import { drawBossHUD } from '@/ui/BossHUD';
import { ARENA_BORDER, getVisibleArena, isArenaConfigured } from './Arena';

export interface BossPlayer { x: number; y: number; radius: number; abilityInvisible?: boolean }
export interface BossCallbacks {
    damagePlayer(amount: number): void;
    pullPlayer(x: number, y: number, lockMs: number): void;
    placeWorm?(enemy: Enemy): void;
    stampGround?(x: number, y: number, radius: number, kind: 'crater' | 'hole' | 'blast'): void;
}
export interface BossHUDState { name: string; health: number; maxHealth: number; ageMs: number; dying: boolean }
type Phase = 'entry' | 'chase' | 'windup' | 'roar' | 'pull' | 'lash' | 'burrow' | 'fissure' | 'eruption' | 'recovery' | 'dying';
interface Ring { x: number; y: number; radius: number; previous: number; max: number; damage: number; hit: boolean; color: string; gapAngle?: number }
interface Ground { x: number; y: number; radius: number; age: number; kind: 'crater' | 'hole' | 'blast' }
const NAMES: Record<string, string> = { boss: 'Мозговорот', steroid: 'Стеройдант', tentacle: 'Щупасдец', worm: 'Чрево' };
const ROAR_RADIUS = 420;
const FISSURE_LENGTH = 650;
const FISSURE_HALF_WIDTH = 46;
const ERUPTION_RADIUS = 92;
const FISSURE_WARNING_MS = 1000;
const ERUPTION_WARNING_MS = 900;
const ACID_DURATION_MS = 4800;
const ACID_TICK_MS = 600;
const ROAR_GAP_HALF_ANGLE = .62;
const SLAM_RANGE = 470;
const SLAM_RADIUS = 130;
const HOOK_RANGE = 560;
const HOOK_HALF_WIDTH = 30;
const SECOND_HOOK_WARNING_MS = 700;
const LASH_RADIUS = 155;
const LASH_WARNING_MS = 800;
const PURSUIT_SPEED = 6.8;

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
    private gapAngle = 0;
    private nextGapSide = 1;
    private pursuing = false;
    private entryStart = { x: 0, y: 0 };
    private anchor = { x: 0, y: 0 };
    private aim = { x: 0, y: 0 };
    private rings: Ring[] = [];
    private ground: Ground[] = [];
    private bursts: { x: number; y: number; radius: number; age: number }[] = [];
    private captured = false;
    private firstHookTarget?: { x: number; y: number };
    private previousPlayer?: { x: number; y: number };
    private wormLead = { x: 0, y: 0 };
    private acidPools: { x: number; y: number; remaining: number }[] = [];
    private acidExposure = 0;
    private fissureAngle = 0;
    private eruptionsLeft = 0;
    private eruptionWarning = ERUPTION_WARNING_MS;
    constructor(private random: () => number = Math.random) {}
    get occupied(): boolean { return this.enemy !== null; }
    get hudState(): BossHUDState | null {
        return this.enemy ? { name: NAMES[this.enemy.type] ?? 'Босс', health: this.enemy.currentHealth,
            maxHealth: this.enemy.maxHealth, ageMs: this.age, dying: this.phase === 'dying' } : null;
    }
    registerBoss(enemy: Enemy): void {
        if (this.enemy) throw new Error('A boss encounter is already active');
        this.enemy = enemy; this.age = 0; this.timer = 2000; this.phase = 'entry'; this.cooldown = 1500;
        this.previousPlayer = undefined; this.wormLead = { x: 0, y: 0 };
        this.acidPools = []; this.acidExposure = 0;
        this.nextGapSide = 1;
        this.pursuing = false;
        this.entryStart = { x: enemy.x, y: enemy.y }; this.anchor = { ...this.entryStart };
        enemy.movementLocked = true; enemy.contactDisabled = true; enemy.invulnerable = true; enemy.targetable = true;
    }
    reset(): void {
        if (this.enemy) { this.enemy.movementLocked = false; this.enemy.contactDisabled = false; this.enemy.invulnerable = false; this.enemy.targetable = true; this.enemy.renderScale = 1; this.enemy.speed = ENEMY_CONFIGS[this.enemy.type].speed; }
        this.acidPools = []; this.acidExposure = 0;
        this.enemy = null; this.rings = []; this.ground = []; this.bursts = []; this.captured = false;
    }
    private mark(x: number, y: number, radius: number, kind: Ground['kind'], callbacks: BossCallbacks): void {
        this.ground.push({ x, y, radius, age: 0, kind });
        if (this.ground.length > 24) this.ground.shift();
        callbacks.stampGround?.(x, y, radius, kind);
    }
    private ring(enemy: Enemy, max: number, damage: number, color = '#f4e4cc', gapAngle?: number): void {
        this.rings.push({ x: enemy.x, y: enemy.y, radius: enemy.radius * .5, previous: 0, max, damage, hit: false, color, gapAngle });
    }
    private aimHook(enemy: Enemy, x: number, y: number): void {
        const angle = Math.atan2(y - enemy.y, x - enemy.x);
        this.aim = { x: enemy.x + Math.cos(angle) * HOOK_RANGE, y: enemy.y + Math.sin(angle) * HOOK_RANGE };
    }
    private relocate(enemy: Enemy, arena: { width: number; height: number }, player: BossPlayer, placeWorm?: BossCallbacks['placeWorm']): void {
        const margin = enemy.radius + 45;
        const view = isArenaConfigured() ? getVisibleArena(player) : { x: 0, y: 0, ...arena };
        const border = isArenaConfigured() ? ARENA_BORDER : 0;
        const insetX = Math.min(enemy.radius + border, arena.width / 2);
        const insetY = Math.min(enemy.radius + border, arena.height / 2);
        const minX = Math.min(arena.width - insetX, Math.max(insetX, view.x + Math.min(margin, view.width / 2)));
        const minY = Math.min(arena.height - insetY, Math.max(insetY, view.y + Math.min(margin, view.height / 2)));
        const maxX = Math.max(minX, Math.min(arena.width - enemy.radius - border, view.x + view.width - margin));
        const maxY = Math.max(minY, Math.min(arena.height - enemy.radius - border, view.y + view.height - margin));
        let x = (minX + maxX) / 2, y = (minY + maxY) / 2;
        for (let i = 0; i < 8; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 210 + this.random() * 120;
            x = Math.max(minX, Math.min(maxX, player.x + Math.cos(angle) * distance));
            y = Math.max(minY, Math.min(maxY, player.y + Math.sin(angle) * distance));
            if (Math.hypot(x - player.x, y - player.y) >= 180) break;
        }
        enemy.x = x; enemy.y = y;
        placeWorm?.(enemy);
        this.anchor = { x: enemy.x, y: enemy.y };
    }
    update(deltaMs: number, player: BossPlayer, arena: { width: number; height: number }, callbacks: BossCallbacks): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        if (this.enemy?.type === EnemyType.WORM) {
            if (this.previousPlayer && !player.abilityInvisible) {
                const dx = player.x - this.previousPlayer.x, dy = player.y - this.previousPlayer.y;
                const scale = Math.min(720 / deltaMs, 210 / (Math.hypot(dx, dy) || 1));
                this.wormLead = { x: dx * scale, y: dy * scale };
            } else this.wormLead = { x: 0, y: 0 };
            this.previousPlayer = player.abilityInvisible ? undefined : { x: player.x, y: player.y };
        }
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
                const inGap = ring.gapAngle !== undefined && Math.cos(Math.atan2(player.y - ring.y, player.x - ring.x) - ring.gapAngle) > Math.cos(ROAR_GAP_HALF_ANGLE);
                if (!inGap) {
                    if (ring.damage > 0) callbacks.damagePlayer(ring.damage);
                    ring.hit = true;
                }
            }
        }
        this.rings = this.rings.filter(ring => ring.radius < ring.max);
        const enemy = this.enemy;
        if (!enemy) return;
        this.age += dt; this.timer -= dt;
        if (enemy.isDead && this.phase !== 'dying') {
            this.acidPools = []; this.acidExposure = 0;
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
        if (enemy.type === EnemyType.WORM) this.updateAcidPools(dt, player, callbacks);
        if (this.phase === 'entry') {
            enemy.faceTarget();
            const progress = Math.min(1, 1 - this.timer / 2000);
            if (enemy.type === EnemyType.WORM) {
                if (this.age === dt) { this.relocate(enemy, arena, player, callbacks.placeWorm); this.mark(enemy.x, enemy.y, enemy.radius, 'hole', callbacks); }
                enemy.renderScale = Math.max(.05, progress);
            } else {
                const x = Math.max(enemy.radius + 25, Math.min(arena.width - enemy.radius - 25, this.entryStart.x));
                const y = Math.max(enemy.radius + 25, Math.min(arena.height - enemy.radius - 25, this.entryStart.y));
                enemy.x = this.entryStart.x + (x - this.entryStart.x) * progress;
                enemy.y = this.entryStart.y + (y - this.entryStart.y) * progress;
            }
            if (this.timer <= 0) { this.phase = 'chase'; enemy.invulnerable = false; enemy.movementLocked = enemy.type === EnemyType.WORM; enemy.contactDisabled = false; enemy.renderScale = 1; }
            return;
        }
        if (enemy.type === EnemyType.WORM) {
            this.updateWorm(dt, enemy, player, arena, callbacks);
            return;
        }
        const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        const unableToTarget = !!player.abilityInvisible || enemy.isFeared;
        if (unableToTarget && (this.phase === 'windup' || this.phase === 'pull' || this.phase === 'lash' || (enemy.isFeared && this.phase === 'roar'))) {
            this.phase = 'chase'; this.cooldown = 800; this.captured = false;
            enemy.movementLocked = false; enemy.contactDisabled = false; enemy.renderScale = 1; enemy.visualLift = 0;
        }
        if (this.phase === 'pull') {
            if (this.captured) this.aim = { x: player.x, y: player.y };
            if (this.captured && distance > enemy.radius + player.radius + 9) {
                const step = Math.min(distance - enemy.radius - player.radius - 8, dt * .48);
                callbacks.pullPlayer(player.x + (enemy.x - player.x) / distance * step,
                    player.y + (enemy.y - player.y) / distance * step, 100);
            }
            if (this.timer <= 0 || distance <= enemy.radius + player.radius + 10) {
                if (this.captured) {
                    // The root from the final pull expires well before this marked sweep lands.
                    this.phase = 'lash'; this.timer = LASH_WARNING_MS; this.captured = false;
                } else {
                    this.phase = 'chase'; this.cooldown = 1800;
                    enemy.movementLocked = false; enemy.contactDisabled = false;
                }
            }
            return;
        }
        if (this.phase === 'lash') {
            if (this.timer <= 0) {
                if (distance <= LASH_RADIUS + player.radius) callbacks.damagePlayer(16);
                this.ring(enemy, LASH_RADIUS, 0, '#8aaa62');
                this.phase = 'chase'; this.cooldown = enemy.currentHealth <= enemy.maxHealth / 2 ? 1250 : 2000;
                enemy.movementLocked = false; enemy.contactDisabled = false;
            }
            return;
        }
        if (this.phase === 'roar') {
            enemy.renderScale = 1 + Math.sin(this.age * .025) * .045;
            while (this.timer <= 0 && this.waves > 0) {
                this.ring(enemy, ROAR_RADIUS, 4, '#f4e4cc', this.gapAngle);
                this.waves--; this.timer += 310;
            }
            if (!this.waves && this.timer <= 0) {
                this.phase = 'chase'; this.cooldown = 3200; enemy.movementLocked = false; enemy.contactDisabled = false; enemy.renderScale = 1;
            }
            return;
        }
        if (this.phase === 'windup') {
            const warning = enemy.type === EnemyType.TENTACLE && !this.firstHookTarget ? SECOND_HOOK_WARNING_MS : 1000;
            const progress = Math.max(0, 1 - this.timer / warning);
            enemy.renderScale = 1 + .1 * Math.sin(progress * Math.PI);
            enemy.visualLift = enemy.type === EnemyType.STEROID ? Math.sin(progress * Math.PI) * 24 : 0;
            if (this.timer > 0) return;
            enemy.visualLift = 0; enemy.renderScale = 1;
            if (enemy.type === EnemyType.STEROID) {
                const radius = SLAM_RADIUS;
                if (Math.hypot(player.x - this.aim.x, player.y - this.aim.y) <= radius + player.radius) callbacks.damagePlayer(18);
                this.mark(this.aim.x, this.aim.y, radius * .65, 'crater', callbacks);
                this.rings.push({ ...this.aim, radius: 5, previous: 0, max: radius, damage: 0, hit: true, color: '#e8be83' });
                this.phase = 'chase'; this.cooldown = enemy.currentHealth <= enemy.maxHealth / 2 ? 1200 : 2300;
                enemy.movementLocked = false; enemy.contactDisabled = false;
            } else if (enemy.type === EnemyType.TENTACLE) {
                // Aimed capture can be sidestepped during the warning; no unavoidable targeted root.
                const ax = this.aim.x - enemy.x, ay = this.aim.y - enemy.y;
                const len = Math.hypot(ax, ay) || 1;
                const projection = ((player.x - enemy.x) * ax + (player.y - enemy.y) * ay) / len;
                const cross = Math.abs((player.x - enemy.x) * ay - (player.y - enemy.y) * ax) / len;
                this.captured = projection > 0 && projection <= HOOK_RANGE && cross < player.radius + HOOK_HALF_WIDTH;
                if (!this.captured && this.firstHookTarget && enemy.currentHealth <= enemy.maxHealth / 2) {
                    // Commit once to the runner's old trajectory; reversing during this warning evades it.
                    const lead = SECOND_HOOK_WARNING_MS / 1000;
                    this.aimHook(enemy, player.x + (player.x - this.firstHookTarget.x) * lead,
                        player.y + (player.y - this.firstHookTarget.y) * lead);
                    this.firstHookTarget = undefined;
                    this.timer = SECOND_HOOK_WARNING_MS;
                    return;
                }
                if (this.captured) callbacks.damagePlayer(16);
                this.phase = 'pull'; this.timer = this.captured ? 1200 : 250;
            } else { this.phase = 'roar'; this.waves = 3; this.timer = 0; }
            return;
        }
        this.cooldown -= dt;
        if (enemy.isFeared) enemy.movementLocked = false;
        const trigger = enemy.type === EnemyType.STEROID ? SLAM_RANGE : enemy.type === EnemyType.TENTACLE ? HOOK_RANGE : ROAR_RADIUS;
        if (unableToTarget || distance <= trigger) this.pursuing = false;
        else if (distance > trigger + 75) this.pursuing = true;
        enemy.speed = this.pursuing ? PURSUIT_SPEED : ENEMY_CONFIGS[enemy.type].speed;
        if (unableToTarget) return;
        if (this.cooldown <= 0 && distance <= trigger) {
            enemy.faceTarget();
            this.phase = 'windup'; this.timer = 1000;
            this.aim = { x: player.x, y: player.y }; enemy.movementLocked = true; enemy.contactDisabled = true;
            if (enemy.type === EnemyType.TENTACLE) {
                this.firstHookTarget = { x: player.x, y: player.y };
                this.aimHook(enemy, player.x, player.y);
            } else if (enemy.type === EnemyType.BOSS) {
                this.gapAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + this.nextGapSide * .75;
                this.nextGapSide *= -1;
            }
        }
    }
    private burrow(enemy: Enemy): void {
        this.phase = 'burrow'; this.timer = 950;
        enemy.invulnerable = true; enemy.targetable = false; enemy.contactDisabled = true;
    }

    private updateWorm(dt: number, enemy: Enemy, player: BossPlayer, arena: { width: number; height: number }, callbacks: BossCallbacks): void {
        // Emergence is the only movement. The mouth, warning and hitbox share one world position.
        enemy.movementLocked = true;
        enemy.x = this.anchor.x; enemy.y = this.anchor.y;
        if (this.phase === 'burrow') {
            enemy.renderScale = Math.max(0, Math.min(1, (this.timer - 300) / 650));
            if (this.timer <= 0) {
                this.relocate(enemy, arena, player, callbacks.placeWorm);
                this.mark(enemy.x, enemy.y, enemy.radius, 'hole', callbacks);
                this.phase = 'entry'; this.timer = 2000; this.cooldown = 350; enemy.targetable = true;
            }
            return;
        }

        const enraged = enemy.currentHealth <= enemy.maxHealth / 2;
        if (this.phase === 'recovery') {
            if (this.timer <= 0) this.burrow(enemy);
            return;
        }
        if (player.abilityInvisible || enemy.isFeared) {
            this.phase = 'chase'; this.cooldown = 500; enemy.renderScale = 1;
            return;
        }
        if (this.phase === 'chase') {
            this.cooldown -= dt;
            if (this.cooldown > 0) return;
            if (Math.hypot(player.x - enemy.x, player.y - enemy.y) > FISSURE_LENGTH) {
                this.burrow(enemy);
                return;
            }
            enemy.faceTarget();
            this.fissureAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            this.phase = 'fissure'; this.timer = FISSURE_WARNING_MS;
            return;
        }
        if (this.phase === 'fissure') {
            enemy.renderScale = 1 + .08 * (1 - this.timer / FISSURE_WARNING_MS);
            if (this.timer > 0) return;
            enemy.renderScale = 1;
            const dx = player.x - enemy.x, dy = player.y - enemy.y;
            const ax = Math.cos(this.fissureAngle), ay = Math.sin(this.fissureAngle);
            const along = Math.max(0, Math.min(FISSURE_LENGTH, dx * ax + dy * ay));
            if (Math.hypot(dx - along * ax, dy - along * ay) <= FISSURE_HALF_WIDTH + player.radius) callbacks.damagePlayer(18);
            for (let i = 1; i <= 7; i++) {
                this.bursts.push({ x: enemy.x + ax * FISSURE_LENGTH * i / 7, y: enemy.y + ay * FISSURE_LENGTH * i / 7, radius: FISSURE_HALF_WIDTH, age: 0 });
            }
            this.eruptionsLeft = enraged ? 2 : 1;
            this.eruptionWarning = ERUPTION_WARNING_MS;
            this.phase = 'eruption'; this.timer = this.eruptionWarning;
            this.aim = this.aimEruption(player, arena);
            return;
        }
        if (this.phase === 'eruption' && this.timer <= 0) {
            if (Math.hypot(player.x - this.aim.x, player.y - this.aim.y) <= ERUPTION_RADIUS + player.radius) callbacks.damagePlayer(24);
            this.bursts.push({ ...this.aim, radius: ERUPTION_RADIUS, age: 0 });
            this.acidPools.push({ ...this.aim, remaining: ACID_DURATION_MS });
            this.mark(this.aim.x, this.aim.y, ERUPTION_RADIUS * .65, 'crater', callbacks);
            if (--this.eruptionsLeft > 0) {
                this.aim = this.aimEruption(player, arena);
                this.eruptionWarning = 800; this.timer = this.eruptionWarning;
            } else {
                this.phase = 'recovery'; this.timer = enraged ? 900 : 1450;
            }
        }
    }

    private aimEruption(player: BossPlayer, arena: { width: number; height: number }): { x: number; y: number } {
        return {
            x: Math.max(0, Math.min(arena.width, player.x + this.wormLead.x)),
            y: Math.max(0, Math.min(arena.height, player.y + this.wormLead.y)),
        };
    }

    private updateAcidPools(dt: number, player: BossPlayer, callbacks: BossCallbacks): void {
        let exposed = false;
        for (const pool of this.acidPools) {
            if (Math.hypot(player.x - pool.x, player.y - pool.y) <= ERUPTION_RADIUS + player.radius) exposed = true;
            pool.remaining -= dt;
        }
        this.acidPools = this.acidPools.filter(pool => pool.remaining > 0);
        this.acidExposure = exposed ? this.acidExposure + dt : 0;
        if (this.acidExposure >= ACID_TICK_MS) {
            callbacks.damagePlayer(10); this.acidExposure -= ACID_TICK_MS;
        }
    }

    private drawWormAttack(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
        if (this.phase !== 'fissure' && this.phase !== 'eruption') return;
        ctx.save();
        ctx.fillStyle = '#ed562b42'; ctx.strokeStyle = '#ffa966'; ctx.lineWidth = 3;
        if (this.phase === 'fissure') {
            ctx.translate(enemy.x, enemy.y); ctx.rotate(this.fissureAngle);
            ctx.beginPath();
            ctx.arc(0, 0, FISSURE_HALF_WIDTH, Math.PI / 2, 3 * Math.PI / 2);
            ctx.arc(FISSURE_LENGTH, 0, FISSURE_HALF_WIDTH, -Math.PI / 2, Math.PI / 2);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            const progress = 1 - Math.max(0, this.timer) / FISSURE_WARNING_MS;
            ctx.strokeStyle = '#ffdb9e'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, 0);
            for (let i = 1; i <= 15; i++) ctx.lineTo(progress * FISSURE_LENGTH * i / 15, i % 2 ? -8 : 8);
            ctx.stroke();
        } else {
            const fraction = Math.max(0, this.timer) / this.eruptionWarning;
            ctx.translate(this.aim.x, this.aim.y);
            ctx.beginPath(); ctx.arc(0, 0, ERUPTION_RADIUS, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#ffe7b0';
            ctx.beginPath(); ctx.arc(0, 0, ERUPTION_RADIUS * fraction, 0, 2 * Math.PI); ctx.stroke();
        }
        ctx.restore();
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
        for (const pool of this.acidPools) {
            ctx.save(); ctx.translate(pool.x, pool.y);
            ctx.globalAlpha = Math.min(1, pool.remaining / 500);
            ctx.fillStyle = '#65980888'; ctx.strokeStyle = '#d4e958b8'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, ERUPTION_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = i * 2.4, radius = 12 + i * 9;
                const bubble = (this.age / 550 + i * .45) % 1;
                ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 2 + bubble * 5, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore();
    }
    drawWorld(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        const enemy = this.enemy;
        if (enemy) {
            if (this.phase === 'dying') enemy.draw(ctx);
            if (enemy.type === EnemyType.WORM) this.drawWormAttack(ctx, enemy);
            if (this.phase === 'windup' || this.phase === 'dying') {
                ctx.strokeStyle = this.phase === 'dying' ? '#ffc66b' : '#fca76b'; ctx.lineWidth = 3;
                ctx.fillStyle = '#ff894429';
                ctx.globalAlpha = .75 + Math.sin(this.age * .015) * .18;
                const radius = this.phase === 'dying' ? enemy.radius * 2.7 : enemy.type === EnemyType.STEROID ? SLAM_RADIUS : ROAR_RADIUS;
                const center = this.phase === 'windup' && enemy.type === EnemyType.STEROID ? this.aim : enemy;
                if (enemy.type === EnemyType.TENTACLE && this.phase === 'windup') {
                    ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.atan2(this.aim.y - enemy.y, this.aim.x - enemy.x));
                    ctx.fillRect(0, -HOOK_HALF_WIDTH, HOOK_RANGE, 2 * HOOK_HALF_WIDTH);
                    ctx.strokeRect(0, -HOOK_HALF_WIDTH, HOOK_RANGE, 2 * HOOK_HALF_WIDTH); ctx.restore();
                } else if (enemy.type === EnemyType.BOSS && this.phase === 'windup') {
                    ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y);
                    ctx.arc(enemy.x, enemy.y, radius, this.gapAngle + ROAR_GAP_HALF_ANGLE, this.gapAngle + 2 * Math.PI - ROAR_GAP_HALF_ANGLE);
                    ctx.closePath(); ctx.fill(); ctx.stroke();
                } else if (enemy.type !== EnemyType.WORM || this.phase !== 'dying') {
                    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
            if (this.phase === 'pull') {
                ctx.strokeStyle = '#8aaa62'; ctx.lineWidth = 5;
                for (const offset of [-10, 10]) { ctx.beginPath(); ctx.moveTo(enemy.x + offset, enemy.y); ctx.quadraticCurveTo((enemy.x + this.aim.x) / 2 + offset * 3, (enemy.y + this.aim.y) / 2, this.aim.x, this.aim.y); ctx.stroke(); }
            }
            if (this.phase === 'lash') {
                ctx.fillStyle = '#e88c4038'; ctx.strokeStyle = '#ffb970'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(enemy.x, enemy.y, LASH_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(enemy.x, enemy.y, LASH_RADIUS * (1 - this.timer / LASH_WARNING_MS), 0, Math.PI * 2); ctx.stroke();
            }
        }
        for (const ring of this.rings) {
            const texture = effectTexture('wave:' + ring.color);
            ctx.globalAlpha = Math.min(.9, (1 - ring.radius / ring.max) * 2.6);
            if (texture) {
                ctx.save();
                if (ring.gapAngle !== undefined) {
                    ctx.beginPath(); ctx.moveTo(ring.x, ring.y);
                    ctx.arc(ring.x, ring.y, ring.radius, ring.gapAngle + ROAR_GAP_HALF_ANGLE, ring.gapAngle + 2 * Math.PI - ROAR_GAP_HALF_ANGLE);
                    ctx.closePath(); ctx.clip();
                }
                ctx.drawImage(texture, ring.x - ring.radius, ring.y - ring.radius, ring.radius * 2, ring.radius * 2); ctx.restore();
            }
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
