import { createGameWorld } from '@/GameRuntime';
import { FixedStep } from '@/core/FixedStep';
import { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';
import { createProjectile } from '@/entities/weapon/ProjectileFactory';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import { Pickup } from '@/gameplay/Pickups';
import { enemyArtReady } from '@/rendering/EnemyArt';
import { ensureCharacterArt } from '@/rendering/CharacterArt';
import { weaponSpritesReady } from '@/rendering/WeaponSprites';
import { bonusArtReady } from '@/rendering/BonusArt';
import { ammoImage } from '@/rendering/AmmoArt';
import { Bullet } from '@/entities/bullet/Bullet';
import { Beam } from '@/entities/bullet/Beam';
import { Flame } from '@/entities/bullet/Flame';
import { Grenade } from '@/entities/bullet/Grenade';
import { AcidGlob, Bolt, ChainLightning, Disc, Pulse } from '@/entities/bullet/SpecialProjectiles';
import { ExplosionEffect } from '@/effects/ExplosionEffect';
import { PickupExplosionEffect } from '@/effects/PickupExplosionEffect';
import { PickupWaveEffect } from '@/effects/PickupWaveEffect';
import { ZombieDeathEffect } from '@/effects/ZombieDeathEffect';
import { MuzzleFlashEffect } from '@/effects/MuzzleFlashEffect';

type Scenario = 'late' | 'crowd' | 'effects' | 'stress1000' | 'artillery30' | 'artillery100' | 'fear';
type Options = { scenario?: Scenario; frames?: number; warmup?: number; dpr?: number; profile?: boolean;
    ablation?: 'enemies' | 'effects' | 'deathParticles' | 'explosions' | 'projectiles' | 'pickups' | 'hud' | 'ground' };
// Private-field access is intentionally confined to this laboratory, never production.
type Mutable = Record<string, any>;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const output = document.querySelector('#result')!;
let running = false;
const summary = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    return { mean: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length), p50: quantile(.5), p95: quantile(.95), p99: quantile(.99), max: quantile(1),
        over16_7: values.filter(x => x > 16.7).length, over33_3: values.filter(x => x > 33.3).length, over50: values.filter(x => x > 50).length };
};

export async function runStress(options: Options = {}) {
    if (running) throw new Error('A stress run is already active');
    running = true;
    const restores: (() => void)[] = [];
    let world: ReturnType<typeof createGameWorld> | undefined;
    const originalRandom = Math.random;
    try {
        const scenario = options.scenario ?? 'late', frames = options.frames ?? 300, warmup = options.warmup ?? 60;
        const dpr = options.dpr ?? window.devicePixelRatio;
        if (frames < 1 || warmup < 0 || !Number.isInteger(frames) || !Number.isInteger(warmup) || !(dpr > 0 && dpr <= 4)) throw new Error('Invalid run options');
        const artillery = scenario.startsWith('artillery'), effects = scenario === 'effects';
        const character = artillery ? 'destroyer' : scenario === 'fear' ? 'assassin' : 'mercenary';
        const ready = await Promise.all([ensureCharacterArt(character), enemyArtReady(), weaponSpritesReady(), bonusArtReady(), bonusArtReady('gold'),
            ...(['infinite', 'shotgun', 'automatic', 'special', 'scientific'] as const).map(kind => ammoImage(kind)!.ready)]);
        if (ready.flat().some(x => !x)) throw new Error('An image failed to prepare');
        const width = innerWidth, height = innerHeight;
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        let seed = 0x912df3;
        Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        world = createGameWorld(undefined, character);
        const state = world as unknown as Mutable, controller = world.getPlayerController(), player = controller.getPlayer();
        state.waveSystem.spawnWave = () => [];
        // Keep the real HUD range while making the synthetic sustained run immortal.
        player.takeDamage = () => {};
        const target = scenario === 'crowd' || scenario === 'fear' ? 330 : scenario === 'stress1000' ? 1000 : effects ? 250 : artillery ? 150 : 150;
        const totals: Record<string, number> = {}, calls: Record<string, number> = {};
        let recording = false;
        const wrap = (object: Mutable, method: string, label: string, skip = false) => {
            if (typeof object[method] !== 'function' || (!options.profile && !skip)) return;
            const own = Object.prototype.hasOwnProperty.call(object, method), original = object[method];
            object[method] = function (...args: unknown[]) {
                if (skip) return;
                if (!recording) return original.apply(this, args);
                const start = performance.now();
                try { return original.apply(this, args); }
                finally { totals[label] = (totals[label] ?? 0) + performance.now() - start; calls[label] = (calls[label] ?? 0) + 1; }
            };
            restores.push(() => { if (own) object[method] = original; else delete object[method]; });
        };
        wrap(state.collisionSystem, 'checkBulletEnemyCollisions', 'collision'); wrap(state.separation, 'resolve', 'separation');
        wrap(Enemy.prototype, 'update', 'enemyUpdate');
        wrap(Enemy.prototype, 'draw', 'enemyDraw', options.ablation === 'enemies');
        wrap(Pickup.prototype, 'draw', 'pickupDraw', options.ablation === 'pickups');
        for (const Type of [Bullet, Beam, Flame, Grenade, AcidGlob, Bolt, ChainLightning, Disc, Pulse]) {
            if (Object.prototype.hasOwnProperty.call(Type.prototype, 'draw')) wrap(Type.prototype, 'draw', 'projectileDraw', options.ablation === 'projectiles');
        }
        for (const Type of [ExplosionEffect, PickupExplosionEffect, PickupWaveEffect, ZombieDeathEffect, MuzzleFlashEffect]) {
            wrap(Type.prototype, 'draw', `effectDraw:${Type.name}`, options.ablation === 'effects' ||
                (options.ablation === 'deathParticles' && Type === ZombieDeathEffect) ||
                (options.ablation === 'explosions' && Type === PickupExplosionEffect));
        }
        wrap(state.uiRenderer, 'draw', 'healthHUD', options.ablation === 'hud');
        wrap(controller, 'drawHUD', 'weaponBonusHUD', options.ablation === 'hud');
        wrap(state, 'stampGround', 'scorchEnqueue', options.ablation === 'ground');
        wrap(state, 'stampBlood', 'bloodEnqueue', options.ablation === 'ground');
        wrap(state, 'applyGround', 'groundStamp', options.ablation === 'ground');
        const addEnemy = () => {
            const angle = Math.random() * Math.PI * 2, radius = 130 + Math.random() * Math.min(width * .4, height * .4);
            const enemy = new Enemy(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius,
                Math.random() < .04 ? EnemyType.BOSS : Math.random() < .2 ? EnemyType.TANK : EnemyType.GRUNT);
            (enemy as unknown as Mutable).health = 1e9;
            if (effects) enemy.applyEffect(Math.random() < .5 ? { burnMs: 1e9, burnDps: 4 } : { slowMs: 1e9, slowFactor: .5 });
            state.enemies.push(enemy);
        };
        while (state.enemies.length < target) addEnemy();
        if (effects) {
            world.activateAbility();
            for (const kind of ['rapidFire', 'doubleDamage', 'shield', 'moveSpeed'] as const) controller.collectPickup(kind, 'gold');
            // Actual weapon cadence/dual-muzzle path runs in addition to synthetic mixed bursts.
            const input = (controller as unknown as Mutable).inputController;
            input.getIsShooting = () => true;
            input.getMousePosition = () => ({ x: width - 80, y: height / 2 });
        }
        const definitions = Object.values(WEAPON_DEFINITIONS).filter((d, index, all) => all.findIndex(other => other.projectile === d.projectile) === index);
        const updates: number[] = [], renders: number[] = [], intervals: number[] = [], maintenance: number[] = [], steps: number[] = [];
        const counts: Record<string, { min: number; max: number }> = {};
        const observe = () => {
            for (const [name, value] of Object.entries({ enemies: state.enemies.length,
                ...(scenario === 'fear' ? { feared: (state.enemies as Enemy[]).filter(enemy => enemy.isFeared).length } : {}),
                projectiles: controller.getBullets().length, pickups: state.pickups.length,
                effects: state.explosions.length + state.pickupExplosions.length + state.pickupWaves.length + state.deathEffects.length + state.muzzleFlashes.length })) {
                const count = counts[name] ??= { min: Infinity, max: 0 }; count.min = Math.min(count.min, value); count.max = Math.max(count.max, value);
            }
        };
        let ticks = 0, index = 0, previous = 0, dropped = 0, abilityActivationMs = 0;
        let groundBatchStart = 0, groundBatchCompleteMs: number | null = null, maxPendingGround = 0;
        const clock = new FixedStep();
        await new Promise<void>((resolve, reject) => {
            const frame = (now: number) => {
                try {
                    recording = index >= warmup;
                    if (index === warmup) { dropped = clock.droppedMs; }
                    const begin = performance.now();
                    let maintainMs = 0;
                    if (artillery && index === warmup + 5) {
                        const victims = scenario === 'artillery30' ? 30 : 100;
                        for (let i = 0; i < victims; i++) (state.enemies[i] as Mutable).health = 1;
                        const start = performance.now(); groundBatchStart = start; world!.activateAbility(); abilityActivationMs = performance.now() - start;
                    }
                    if (scenario === 'fear' && index === warmup + 5) {
                        const start = performance.now(); groundBatchStart = start; world!.activateAbility(); abilityActivationMs = performance.now() - start;
                    }
                    const count = clock.advance(now, dt => {
                        const start = performance.now();
                        while (state.enemies.length < target) addEnemy();
                        if (effects) {
                            while (state.pickups.length < 80) state.pickups.push(new Pickup('rapidFire', 50 + Math.random() * (width - 100), 50 + Math.random() * (height - 160), player.x, player.y, 0, 100));
                            if (ticks % 6 === 0) for (const definition of definitions) {
                                const projectile = createProjectile(definition, player.x, player.y, ticks * .11 + Math.random() * .3, definition.damage);
                                controller.getBullets().push(projectile);
                            }
                        } else if (!artillery && ticks % 3 === 0) controller.getBullets().push(createProjectile(WEAPON_DEFINITIONS['machine-gun'], player.x, player.y, ticks * .12, 2));
                        maintainMs += performance.now() - start;
                        ticks++; world!.update(dt);
                    });
                    const updated = performance.now();
                    ctx.clearRect(0, 0, width, height); world!.draw(ctx);
                    const finished = performance.now();
                    maxPendingGround = Math.max(maxPendingGround, state.groundStamps.pendingCount);
                    if (groundBatchStart && groundBatchCompleteMs === null && state.groundStamps.pendingCount === 0) groundBatchCompleteMs = finished - groundBatchStart;
                    if (recording) { updates.push(updated - begin); renders.push(finished - updated); intervals.push(now - previous); maintenance.push(maintainMs); steps.push(count); observe(); }
                    previous = now;
                    if (++index < frames + warmup) requestAnimationFrame(frame); else resolve();
                } catch (error) { reject(error); }
            };
            requestAnimationFrame(frame);
        });
        const report = { scenario, seed: '0x912df3', frames, warmup, viewport: { width, height, dpr }, browser: navigator.userAgent, ablation: options.ablation ?? null,
            profile: options.profile ?? false, groundBatchCompleteMs, maxPendingGround, notes: ['Synthetic sustained population; not a measured natural wave.', 'Seed fixes random sequence, not identical trajectories: rAF timing changes fixed-step counts and random consumption across runs.', 'Effects runs actual dual-pistol cadence plus synthetic mixed-projectile bursts every six ticks.', 'Update includes explicit maintenance; maintenance is separately reported.', 'Canvas CPU submission time excludes deferred GPU work; frame intervals include presentation scheduling.', 'HUD ablation excludes health/weapons/bonus HUD, leaves ability and consumable HUD.'],
            frameIntervalMs: summary(intervals), updateMs: summary(updates), renderMs: summary(renders), maintenanceMs: summary(maintenance), fixedStepsPerFrame: summary(steps),
            droppedSimulationMs: clock.droppedMs - dropped, abilityActivationMs, counts,
            componentsMeanMsPerFrame: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / frames])), componentCalls: calls };
        Object.assign(window, { lastStressReport: report }); output.textContent = JSON.stringify(report, null, 2);
        return report;
    } finally {
        restores.reverse().forEach(restore => restore()); world?.dispose(); world?.getPlayerController().dispose(); Math.random = originalRandom; running = false;
    }
}
Object.assign(window, { runStress });
document.querySelector('#run')!.addEventListener('click', () => {
    output.textContent = 'Running…';
    void runStress({ scenario: (document.querySelector('#scenario') as HTMLSelectElement).value as Scenario }).catch(error => { output.textContent = String(error); });
});
