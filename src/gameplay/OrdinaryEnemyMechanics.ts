import { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType, isBossType } from '@/entities/enemy/EnemyType';
import type { Player } from '@/entities/player/Player';
import { drawFatCorpse } from '@/rendering/EnemyArt';

type Corpse = { x: number; y: number; radius: number; hits: number; age: number; variant: number };
type Glob = { x: number; y: number; vx: number; vy: number; life: number; radius: number };
type Stain = { x: number; y: number; radius: number; age: number; seed: number };
type Jump = { phase: 'windup' | 'air' | 'recover'; elapsed: number; fromX: number; fromY: number; toX: number; toY: number; hit: boolean };
export interface OrdinaryEnemyCallbacks { applySlow(durationMs: number, factor: number): void }
const ZOMBIES = new Set([EnemyType.GRUNT, EnemyType.RUNNER, EnemyType.ARMORED, EnemyType.SLOWER, EnemyType.CYAN]);
const GREEN_DEATHS = new Set([EnemyType.BUG, EnemyType.LEECH, EnemyType.BEETLE, EnemyType.JUMPER]);

/** Ordinary attacks use simulation time exclusively; reset on every new run. */
export class OrdinaryEnemyMechanics {
    private corpses: Corpse[] = [];
    private globs: Glob[] = [];
    private stains: Stain[] = [];
    private cooldowns = new WeakMap<Enemy, number>();
    private feedCooldowns = new WeakMap<Enemy, number>();
    private jumps = new Map<Enemy, Jump>();
    private handled = new WeakSet<Enemy>();
    get corpseCount(): number { return this.corpses.length; }
    get projectileCount(): number { return this.globs.length; }
    get greenMarkCount(): number { return this.stains.length; }

    clear(): void {
        this.corpses = []; this.globs = []; this.stains = []; this.jumps.clear();
        this.cooldowns = new WeakMap(); this.feedCooldowns = new WeakMap(); this.handled = new WeakSet();
    }
    onDeath(enemy: Enemy): void {
        if (!enemy.isDead || this.handled.has(enemy)) return;
        this.handled.add(enemy); this.jumps.delete(enemy);
        if (enemy.type === EnemyType.TANK) {
            this.corpses.push({ x: enemy.x, y: enemy.y, radius: enemy.radius, hits: 0, age: 0, variant: enemy.visualVariant });
            // Bound ground state even during exceptional developer-spawn sessions.
            if (this.corpses.length > 40) this.corpses.shift();
        } else if (GREEN_DEATHS.has(enemy.type)) this.greenPop(enemy.x, enemy.y, Math.max(10, enemy.radius * 1.2));
    }
    private greenPop(x: number, y: number, radius: number): void {
        this.stains.push({ x, y, radius, age: 0, seed: x * .37 + y * .71 });
        if (this.stains.length > 140) this.stains.shift();
    }

    update(deltaMs: number, enemies: readonly Enemy[], player: Player, callbacks: OrdinaryEnemyCallbacks): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        for (const mark of this.stains) mark.age += deltaMs;
        for (const corpse of this.corpses) corpse.age += deltaMs;
        for (const enemy of enemies) {
            if (enemy.isDead || isBossType(enemy.type)) continue;
            enemy.movementLocked = false; enemy.contactDisabled = false; enemy.visualLift = 0; enemy.renderScale = 1;
            const cooldown = Math.max(0, (this.cooldowns.get(enemy) ?? (enemy.type === EnemyType.SPITTER ? 900 : 0)) - deltaMs);
            this.cooldowns.set(enemy, cooldown);
            if (enemy.isFeared) { this.jumps.delete(enemy); continue; }
            if (ZOMBIES.has(enemy.type) && this.feed(enemy, deltaMs)) continue;
            const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (enemy.type === EnemyType.SLOWER && distance < enemy.radius + player.radius + 2 && !player.abilityInvisible) {
                callbacks.applySlow(1000, .68);
            }
            if (player.abilityInvisible) { this.jumps.delete(enemy); continue; }
            if (enemy.type === EnemyType.SPITTER) {
                enemy.contactDisabled = true; enemy.faceTarget();
                if (cooldown < 420 && distance < 460) { enemy.movementLocked = true; enemy.renderScale = 1 + .1 * (1 - cooldown / 420); }
                if (distance < 340 && distance > 110) enemy.movementLocked = true;
                if (distance < 460 && distance > 45 && cooldown === 0) {
                    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                    this.globs.push({ x: enemy.x + Math.cos(angle) * enemy.radius, y: enemy.y + Math.sin(angle) * enemy.radius,
                        vx: Math.cos(angle) * .24, vy: Math.sin(angle) * .24, radius: 8, life: 2300 });
                    this.cooldowns.set(enemy, 2300);
                }
            }
            if (enemy.type === EnemyType.JUMPER) {
                if (!this.jumps.has(enemy) && cooldown === 0 && distance < player.radius * 10 && distance > 55) {
                    this.jumps.set(enemy, { phase: 'windup', elapsed: 0, fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y, hit: false });
                }
                const jump = this.jumps.get(enemy);
                if (jump) this.updateJump(enemy, jump, deltaMs, player);
            }
        }
        this.corpses = this.corpses.filter(corpse => corpse.hits < 5);
        for (const [enemy] of this.jumps) if (enemy.isDead || !enemies.includes(enemy)) this.jumps.delete(enemy);
        // Segment collision prevents a fast projectile skipping through a player on a slow frame.
        this.globs = this.globs.filter(glob => {
            const oldX = glob.x, oldY = glob.y;
            const dt = Math.min(deltaMs, glob.life);
            glob.x += glob.vx * dt; glob.y += glob.vy * dt; glob.life -= deltaMs;
            const dx = glob.x - oldX, dy = glob.y - oldY, lengthSq = dx * dx + dy * dy;
            const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((player.x - oldX) * dx + (player.y - oldY) * dy) / lengthSq)) : 0;
            if (Math.hypot(player.x - oldX - dx * t, player.y - oldY - dy * t) < player.radius + glob.radius) {
                player.takeDamage(2); this.greenPop(glob.x, glob.y, 12); return false;
            }
            return glob.life > 0;
        });
    }
    private feed(enemy: Enemy, deltaMs: number): boolean {
        let closest: Corpse | undefined, nearest = 190;
        for (const corpse of this.corpses) {
            if (corpse.hits >= 5) continue;
            const distance = Math.hypot(enemy.x - corpse.x, enemy.y - corpse.y);
            if (distance < nearest) { nearest = distance; closest = corpse; }
        }
        if (!closest) return false;
        enemy.setTarget(closest.x, closest.y); enemy.faceTarget(); enemy.contactDisabled = true;
        if (nearest > closest.radius + enemy.radius * .6) return true;
        enemy.movementLocked = true;
        const remaining = (this.feedCooldowns.get(enemy) ?? 650) - deltaMs;
        if (remaining <= 0) {
            closest.hits++;
            this.feedCooldowns.set(enemy, 650);
            if (closest.hits === 5) this.greenPop(closest.x, closest.y, closest.radius * 1.25);
        } else this.feedCooldowns.set(enemy, remaining);
        // A small breathing/biting motion without moving the collision body.
        enemy.renderScale = 1 + .025 * Math.sin(remaining / 650 * Math.PI * 2);
        return true;
    }
    private updateJump(enemy: Enemy, jump: Jump, deltaMs: number, player: Player): void {
        enemy.movementLocked = true; enemy.contactDisabled = true;
        jump.elapsed += deltaMs;
        if (jump.phase === 'windup') {
            enemy.renderScale = 1 - .12 * Math.min(1, jump.elapsed / 380);
            if (jump.elapsed >= 380) { jump.phase = 'air'; jump.elapsed = 0; jump.fromX = enemy.x; jump.fromY = enemy.y; }
        } else if (jump.phase === 'air') {
            const t = Math.min(1, jump.elapsed / 420);
            const oldX = enemy.x, oldY = enemy.y;
            enemy.x = jump.fromX + (jump.toX - jump.fromX) * t;
            enemy.y = jump.fromY + (jump.toY - jump.fromY) * t;
            enemy.visualLift = Math.sin(t * Math.PI) * 24; enemy.renderScale = 1 + Math.sin(t * Math.PI) * .12;
            const dx = enemy.x - oldX, dy = enemy.y - oldY, d2 = dx * dx + dy * dy;
            const q = d2 ? Math.max(0, Math.min(1, ((player.x - oldX) * dx + (player.y - oldY) * dy) / d2)) : 0;
            if (!jump.hit && Math.hypot(player.x - oldX - dx * q, player.y - oldY - dy * q) < enemy.radius + player.radius) {
                player.takeDamage(enemy.damage); jump.hit = true;
            }
            if (t === 1) { jump.phase = 'recover'; jump.elapsed = 0; enemy.visualLift = 0; }
        } else if (jump.elapsed >= 450) {
            this.jumps.delete(enemy); this.cooldowns.set(enemy, 1800); enemy.renderScale = 1;
        }
    }

    drawGround(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        for (const mark of this.stains) {
            ctx.globalAlpha = .4;
            ctx.fillStyle = '#3d502d';
            ctx.beginPath(); ctx.ellipse(mark.x, mark.y, mark.radius, mark.radius * .68, mark.seed, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#687b43';
            for (let i = 0; i < 6; i++) {
                const a = i * 2.4 + mark.seed, r = mark.radius * (.4 + (i % 3) * .22);
                ctx.beginPath(); ctx.arc(mark.x + Math.cos(a) * r, mark.y + Math.sin(a) * r * .7, 2 + i % 3, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        for (const corpse of this.corpses) {
            if (drawFatCorpse(ctx, corpse.x, corpse.y, corpse.radius, corpse.variant)) continue;
            ctx.save(); ctx.translate(corpse.x, corpse.y); ctx.rotate(corpse.variant);
            ctx.fillStyle = '#20281b'; ctx.beginPath(); ctx.ellipse(2, 5, corpse.radius * 1.1, corpse.radius * .8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = corpse.variant > 0 ? '#6b7728' : '#426526';
            ctx.strokeStyle = '#243720'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(0, 0, corpse.radius, corpse.radius * .75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#91a14a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(-3, 0, corpse.radius * .57, -.7, 2.5); ctx.stroke();
            // Open neck: a headless body, not another standing enemy.
            ctx.fillStyle = '#283b19'; ctx.beginPath(); ctx.ellipse(corpse.radius * .83, 0, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < corpse.hits; i++) { ctx.fillStyle = '#23351b'; ctx.beginPath(); ctx.arc(-15 + i * 7, 5 + (i % 2) * 8, 4, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        }
        for (const [enemy, jump] of this.jumps) {
            if (jump.phase !== 'windup') continue;
            ctx.strokeStyle = 'rgba(173,213,81,.65)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(jump.toX, jump.toY, enemy.radius + 7, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        for (const glob of this.globs) {
            ctx.fillStyle = '#2d531c'; ctx.beginPath(); ctx.arc(glob.x, glob.y, glob.radius + 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8bb737'; ctx.beginPath(); ctx.arc(glob.x, glob.y, glob.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c6db79'; ctx.beginPath(); ctx.arc(glob.x - 2, glob.y - 3, 3, 0, Math.PI * 2); ctx.fill();
        }
        for (const mark of this.stains) {
            if (mark.age > 300) continue;
            const t = mark.age / 300; ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#b2da4b'; ctx.lineWidth = 3 * (1 - t);
            ctx.beginPath(); ctx.arc(mark.x, mark.y, mark.radius * (.3 + t), 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#8fb52b';
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + mark.seed, r = mark.radius * t * 1.5;
                ctx.beginPath(); ctx.arc(mark.x + Math.cos(a) * r, mark.y + Math.sin(a) * r, 2 * (1 - t), 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    }
}
