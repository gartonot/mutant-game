import type { Player } from '../entities/player/Player';
import type { Enemy } from '../entities/enemy/Enemy';
import type { CharacterId } from './ids';
import { CHARACTER_ABILITIES } from './CharacterAbilities';
import { drawEnemyArt } from '../rendering/EnemyArt';
import { drawCharacter } from '../rendering/CharacterArt';
import { drawMutantTransformation } from '../rendering/MutantTransformation';
import { drawMutantClaws } from '../rendering/MutantClaws';
import { EnemyType } from '../entities/enemy/EnemyType';
import { GravityPulseEffect } from '../effects/GravityPulseEffect';
import { GoliathSlamEffect } from '../effects/GoliathSlamEffect';
import { drawStormLightning } from '../rendering/StormLightning';
import { PlasmaTraps } from './PlasmaTraps';
import { drawBeetleSwarm } from '../rendering/BeetleSwarm';
import { drawPlasmaOrb } from '../rendering/PlasmaOrbArt';
import { drawPyrokinesisFire } from '../rendering/PyrokinesisFire';
import { PyrokinesisScorch } from '../effects/PyrokinesisScorch';
import { PlasmaOrbScorch } from '../effects/PlasmaOrbScorch';

type Point = { x: number; y: number };
type Ring = Point & { radius: number; age: number; color: string };

/** Battle-owned effects: the world owns cooldowns, kills, rewards and pause gating. */
export class ExtendedCharacterAbilities {
    private kind: CharacterId | null = null;
    private remaining = 0;
    private elapsed = 0;
    private pulseElapsed = 0;
    private center: Point = { x: 0, y: 0 };
    private traps?: PlasmaTraps;
    private touched = new Set<Enemy>();
    private rings: Ring[] = [];
    private gravityPulse?: GravityPulseEffect;
    private groundSlams: GoliathSlamEffect[] = [];
    private scorchMarks: (PyrokinesisScorch | PlasmaOrbScorch)[] = [];
    private slamHit = false;
    private mutantStrikeTimes = [-Infinity, -Infinity];
    private mutantNextHand = 0;

    constructor(private readonly player: Player, private readonly getEnemies: () => Enemy[],
        private readonly getAim: () => Point) {}

    get isActive(): boolean { return this.remaining > 0; }

    activate(): void {
        this.dispose(false);
        if (this.player.currentHp <= 0) return;
        this.kind = this.player.character;
        this.remaining = CHARACTER_ABILITIES[this.kind]?.durationMs ?? 0;
        this.center = { x: this.player.x, y: this.player.y };
        if (this.kind === 'goliath') {
            this.player.abilityMoveSpeed = 0;
            this.player.abilityBlocksShooting = true;
            this.player.abilityPoseProgress = 0;
            this.player.abilityPoseAngle = this.player.angle;
        } else if (this.kind === 'cyborg') {
            this.blast(this.player, 240, 4, '#b3a0ff', 90, false);
            this.gravityPulse = new GravityPulseEffect(this.player.x, this.player.y, 240);
        } else if (this.kind === 'half-mutant' || this.kind === 'fanatic') {
            this.player.abilityMoveSpeed = this.kind === 'half-mutant' ? 1.7 : 2;
            this.player.abilityBlocksShooting = true;
            this.player.abilityForm = this.kind === 'half-mutant' ? 'mutant' : 'storm';
        } else if (this.kind === 'hunter' || this.kind === 'silver-hunter') {
            this.traps = new PlasmaTraps(this.player, this.getEnemies, this.aim(), (x, y) => {
                this.scorchMarks.push(new PyrokinesisScorch(x, y, 34, 12000, 120));
                if (this.scorchMarks.length > 18) this.scorchMarks.shift();
            });
            this.player.abilityInvisible = this.kind === 'silver-hunter';
        } else if (this.kind === 'telepath' || this.kind === 'witcher') {
            this.center = this.aim();
            if (this.kind === 'telepath') {
                this.scorchMarks.push(new PyrokinesisScorch(this.center.x, this.center.y, 125));
                if (this.scorchMarks.length > 6) this.scorchMarks.shift();
            }
        }
    }

    update(deltaMs: number): void {
        if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
        if (this.player.currentHp <= 0) { this.dispose(); return; }
        this.traps?.update(deltaMs);
        this.rings = this.rings.filter(ring => (ring.age += deltaMs) < 450);
        this.gravityPulse?.update(deltaMs);
        if (this.gravityPulse?.isExpired) this.gravityPulse = undefined;
        for (const slam of this.groundSlams) slam.update(deltaMs);
        this.groundSlams = this.groundSlams.filter(slam => !slam.isExpired);
        for (const mark of this.scorchMarks) mark.update(deltaMs);
        this.scorchMarks = this.scorchMarks.filter(mark => !mark.isExpired);
        // Bounded by the longest active duration, even after a delayed frame.
        let budget = Math.min(deltaMs, this.remaining);
        while (budget > 1e-7 && this.remaining > 1e-7) {
            const step = Math.min(100, budget);
            budget -= step;
            this.remaining = Math.max(0, this.remaining - step);
            this.elapsed += step;
            this.tick(step);
        }
        if (this.kind && this.remaining <= 1e-7) this.finish();
    }

    private tick(delta: number): void {
        const kind = this.kind;
        if (kind === 'goliath') {
            this.player.abilityPoseProgress = Math.min(1, this.elapsed / 700);
            if (!this.slamHit && this.elapsed >= 280) {
                this.slamHit = true;
                this.blast(this.player, 220, 5, '#eeb45e', 20, false);
                this.groundSlams.push(new GoliathSlamEffect(this.player.x, this.player.y, this.player.abilityPoseAngle, 220));
                if (this.groundSlams.length > 6) this.groundSlams.shift();
            }
        } else if (kind === 'nuclear' || kind === 'plasma-nuclear') {
            const previous = { ...this.center };
            this.followAim(delta, 600);
            const dx = this.center.x - previous.x, dy = this.center.y - previous.y;
            const lengthSquared = dx * dx + dy * dy;
            for (const enemy of this.getEnemies()) {
                if (enemy.isDead || this.touched.has(enemy)) continue;
                const t = lengthSquared ? Math.max(0, Math.min(1,
                    ((enemy.x - previous.x) * dx + (enemy.y - previous.y) * dy) / lengthSquared)) : 0;
                if (!this.near(enemy, { x: previous.x + dx * t, y: previous.y + dy * t }, 42)) continue;
                this.touched.add(enemy);
                enemy.applyEffect({ slowMs: 1000, slowFactor: 0 });
                enemy.receiveDamage(1);
            }
        } else if (kind === 'hunter' || kind === 'silver-hunter') {
            if (this.elapsed >= 5000) this.player.abilityInvisible = false;
            if (!this.traps?.isActive) {
                this.player.abilityInvisible = false;
                this.remaining = 0;
            }
        } else if (kind === 'half-mutant' || kind === 'fanatic' || kind === 'telepath' || kind === 'witcher') {
            if (kind === 'witcher') {
                this.followAim(delta, 360);
                this.player.heal(3 * delta / 1000);
            }
            this.pulseElapsed += delta;
            const interval = kind === 'telepath' ? 500 : 250;
            while (this.pulseElapsed >= interval) {
                this.pulseElapsed -= interval;
                const origin = kind === 'half-mutant' || kind === 'fanatic' ? this.player : this.center;
                const radius = kind === 'half-mutant' ? 65 : kind === 'fanatic' ? 110 : kind === 'telepath' ? 125 : 130;
                let healed = 0;
                let struck = false;
                for (const enemy of this.getEnemies()) {
                    if (enemy.isDead || !this.near(enemy, origin, radius)) continue;
                    struck = true;
                    if (kind === 'telepath') enemy.applyEffect({ burnMs: 1000, burnDps: 1 });
                    enemy.receiveDamage(kind === 'half-mutant' || kind === 'fanatic' ? 1 : .5);
                    if (kind === 'half-mutant' && healed < 2) { this.player.heal(.5); healed += .5; }
                }
                if (kind === 'half-mutant' && struck) {
                    this.mutantStrikeTimes[this.mutantNextHand] = this.elapsed - this.pulseElapsed;
                    this.mutantNextHand = 1 - this.mutantNextHand;
                }
            }
        }
    }

    private aim(): Point {
        const aim = this.getAim();
        return Number.isFinite(aim.x) && Number.isFinite(aim.y) ? { ...aim } : { x: this.player.x, y: this.player.y };
    }
    private followAim(delta: number, speed: number): void {
        const aim = this.aim(), dx = aim.x - this.center.x, dy = aim.y - this.center.y;
        const distance = Math.hypot(dx, dy), amount = Math.min(distance, speed * delta / 1000);
        if (distance > 0) { this.center.x += dx / distance * amount; this.center.y += dy / distance * amount; }
    }
    private near(enemy: Enemy, point: Point, radius: number): boolean {
        return (enemy.x - point.x) ** 2 + (enemy.y - point.y) ** 2 <= (radius + enemy.radius) ** 2;
    }
    private blast(point: Point, radius: number, damage: number, color: string, push: number, showRing = true): void {
        for (const enemy of this.getEnemies()) {
            if (!enemy.isDead && this.near(enemy, point, radius)) {
                enemy.receiveDamage(damage, Math.atan2(enemy.y - point.y, enemy.x - point.x), push);
            }
        }
        if (showRing) this.rings.push({ x: point.x, y: point.y, radius, age: 0, color });
        if (this.rings.length > 8) this.rings.shift();
    }
    private finish(): void {
        if (this.kind === 'nuclear' || this.kind === 'plasma-nuclear') {
            this.blast(this.center, 150, 6, this.kind === 'plasma-nuclear' ? '#d99aff' : '#8ff6ff', 35);
            this.scorchMarks.push(new PlasmaOrbScorch(this.center.x, this.center.y, this.kind === 'plasma-nuclear'));
            if (this.scorchMarks.length > 18) this.scorchMarks.shift();
        }
        this.kind = null;
        this.remaining = 0;
        this.touched.clear();
        this.resetPlayer();
    }
    private resetPlayer(): void {
        this.player.abilityMoveSpeed = 1;
        this.player.abilityBlocksShooting = false;
        this.player.abilityInvisible = false;
        this.player.abilityForm = null;
        this.player.abilityPoseProgress = null;
    }
    dispose(clearGround = true): void {
        this.kind = null; this.remaining = 0; this.elapsed = 0; this.pulseElapsed = 0;
        this.traps?.dispose(); this.traps = undefined; this.touched.clear(); this.rings = [];
        this.gravityPulse = undefined;
        if (clearGround) { this.groundSlams = []; this.scorchMarks = []; }
        this.slamHit = false;
        this.mutantStrikeTimes = [-Infinity, -Infinity];
        this.mutantNextHand = 0;
        this.resetPlayer();
    }

    drawGroundEffects(ctx: CanvasRenderingContext2D): void {
        for (const slam of this.groundSlams) slam.draw(ctx);
        for (const mark of this.scorchMarks) mark.draw(ctx);
        this.traps?.drawGround(ctx);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this.gravityPulse?.draw(ctx);
        this.traps?.draw(ctx);
        ctx.save();
        for (const ring of this.rings) {
            ctx.globalAlpha = 1 - ring.age / 450;
            this.circle(ctx, ring, ring.radius * (.25 + .75 * ring.age / 450), ring.color, false, 5);
        }
        ctx.globalAlpha = 1;
        const phase = this.elapsed / 180;
        if (this.kind === 'half-mutant') {
            drawMutantTransformation(ctx, this.player.x, this.player.y, this.elapsed, this.remaining,
                layer => drawCharacter(layer, this.player.character, this.player.weapon, 0, 0,
                    this.player.angle, 1, this.player.recoil),
                layer => this.drawMutantBody(layer, phase));
        } else if (this.kind === 'fanatic') {
            drawStormLightning(ctx, this.player.x, this.player.y, this.elapsed, 110);
        } else if (this.kind === 'nuclear' || this.kind === 'plasma-nuclear') {
            drawPlasmaOrb(ctx, this.center.x, this.center.y, this.elapsed, this.kind === 'plasma-nuclear');
        } else if (this.kind === 'telepath') {
            ctx.globalAlpha = Math.min(1, this.elapsed / 180, this.remaining / 350);
            drawPyrokinesisFire(ctx, this.center.x, this.center.y, this.elapsed, 125);
        } else if (this.kind === 'witcher') {
            drawBeetleSwarm(ctx, this.center.x, this.center.y, this.elapsed, 130);
        }
        ctx.restore();
    }
    private drawMutantBody(ctx: CanvasRenderingContext2D, phase: number): void {
        const bodyDrawn = drawEnemyArt(ctx, EnemyType.TANK, 0, 0, 32, this.player.angle, phase);
        ctx.save(); ctx.rotate(this.player.angle);
        if (!bodyDrawn) {
            ctx.fillStyle = '#687d39';
            ctx.beginPath(); ctx.ellipse(-3, 0, 29, 23, 0, 0, Math.PI * 2); ctx.fill();
            this.circle(ctx, { x: 18, y: 0 }, 14, '#a8bd65', true);
        }
        drawMutantClaws(ctx, this.elapsed, this.mutantStrikeTimes);
        ctx.restore();
    }

    private circle(ctx: CanvasRenderingContext2D, point: Point, radius: number, color: string, fill: boolean, width = 1): void {
        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = color; ctx.fill(); }
        else { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
    }
}
