import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createWeapon } from '../../src/entities/weapon/WeaponFactory';
import { WEAPON_DEFINITIONS } from '../../src/gameplay/weapons';
import { Enemy } from '../../src/entities/enemy/Enemy';
import { EnemyType } from '../../src/entities/enemy/EnemyType';
import { ENEMY_CONFIGS } from '../../src/entities/enemy/enemyConfigs';
import { CollisionSystem } from '../../src/systems/CollisionSystem';
import { arsenalBonuses } from '../../src/gameplay/arsenal';
import { applyImplants } from '../../src/gameplay/implants';
import { BASE_STATS } from '../../src/gameplay/stats';
import type { Bullet } from '../../src/entities/bullet/Bullet';
import type { PlayerController } from '../../src/systems/Player/PlayerController';
import type { WeaponId } from '../../src/gameplay/ids';
import { PlayerWeaponController } from '../../src/systems/Player/PlayerWeaponController';
import { runMovingFlame } from './flame-moving';

const stepMs = 1000 / 60, seconds = 60;
const profiles = [
    { id: 'new', arsenalPointsInTestedCategory: 0, implants: { health: 0, attackSpeed: 0, moveSpeed: 0, damage: 0 } },
    { id: 'mid-offense', arsenalPointsInTestedCategory: 25, implants: { health: 20, attackSpeed: 15, moveSpeed: 0, damage: 15 } },
    { id: 'max-damage', arsenalPointsInTestedCategory: 50, implants: { health: 0, attackSpeed: 0, moveSpeed: 0, damage: 100 } },
    { id: 'max-speed', arsenalPointsInTestedCategory: 50, implants: { health: 0, attackSpeed: 100, moveSpeed: 0, damage: 0 } },
];
const round = (n: number) => Math.round(n * 1000) / 1000;

function measure(id: WeaponId, profile: typeof profiles[number], type: EnemyType, count: number, hypotheticalHp?: number, hypotheticalArmor = 0, initialAmmo?: number) {
    const stats = applyImplants(BASE_STATS, profile.implants), bonus = arsenalBonuses(profile.arsenalPointsInTestedCategory);
    const weapon = createWeapon(id, stats.damage * (1 + bonus.damage), stats.attackSpeed * (1 + bonus.attackSpeed), undefined, 1, 1 + bonus.ammo, initialAmmo);
    const hp = hypotheticalHp ?? ENEMY_CONFIGS[type].maxHealth;
    const collision = new CollisionSystem();
    let bullets: Bullet[] = [], useful = 0, excess = 0, kills = 0, shots = 0, firstKillMs: number | null = null;
    let emptyMs: number | null = null, now = 0;
    const firing = new PlayerWeaponController([weapon], () => now);
    const spawn = (index: number) => {
        const enemy = new Enemy(250 + index * 52, 360, type);
        // Synthetic future target fixture only: no such health/armor settings exist in the live catalog.
        if (hypotheticalHp !== undefined) Object.assign(enemy, { health: hp });
        enemy.speed = 0;
        let remaining = hp;
        const receive = enemy.receiveDamage.bind(enemy);
        enemy.receiveDamage = (amount, angle) => {
            if (enemy.isDead) return;
            amount *= 1 - hypotheticalArmor;
            useful += Math.min(remaining, amount);
            excess += Math.max(0, amount - remaining);
            remaining = Math.max(0, remaining - amount);
            // An anchored target fixture isolates damage; real damage/death/status code still executes.
            receive(amount, angle, 0);
            if (enemy.isDead) { kills++; firstKillMs ??= now; }
        };
        return enemy;
    };
    const targets = Array.from({ length: count }, (_, i) => spawn(i));
    const controller = { getBullets: () => bullets, registerHit() {}, registerProjectiles() {} } as unknown as PlayerController;
    const startingAmmo = weapon.state.ammoRemaining;
    for (let frame = 0; frame < seconds * 60; frame++) {
        now = frame * stepMs;
        for (let i = 0; i < count; i++) if (targets[i].isDead) targets[i] = spawn(i);
        const fired = firing.tryShoot(100, 360, 0);
        if (fired?.length) { shots += fired.length / WEAPON_DEFINITIONS[id].pellets.length; bullets.push(...fired); }
        firing.setBullets([]);
        if (!weapon.state.hasAmmo) emptyMs ??= now;
        for (const bullet of bullets) if (!bullet.isDead) bullet.update(stepMs);
        collision.checkBulletEnemyCollisions(controller, targets);
        for (const target of targets) target.update(stepMs);
        bullets = bullets.filter(bullet => !bullet.isDead && !bullet.expired);
    }
    return { weapon: id, profile: profile.id, hp, targetCount: count,
        ...(hypotheticalHp === undefined ? {} : { hypothetical: true, uniformDamageReduction: hypotheticalArmor }), shots, kills,
        firstKillMs: firstKillMs === null ? null : round(firstKillMs), usefulDamage: round(useful), overkillDamage: round(excess),
        usefulDps: round(useful / seconds), ammoSpent: Number.isFinite(startingAmmo) ? startingAmmo - weapon.state.ammoRemaining : null,
        ammoRemaining: Number.isFinite(startingAmmo) ? weapon.state.ammoRemaining : null,
        emptyMs: emptyMs === null ? null : round(emptyMs) };
}

function cadence(id: WeaponId, speed: number) {
    const weapon = createWeapon(id, 1, speed);
    let shots = 0, now = 0;
    const firing = new PlayerWeaponController([weapon], () => now);
    for (let frame = 0; frame < seconds * 60; frame++) {
        now = frame * stepMs;
        if (Number.isFinite(weapon.state.ammoCapacity)) weapon.state.addAmmo(10);
        shots += (firing.tryShoot(100, 360, 0)?.length ?? 0) / WEAPON_DEFINITIONS[id].pellets.length;
        firing.setBullets([]);
    }
    return { weapon: id, attackSpeed: speed, shots, shotsPerSecond: round(shots / seconds) };
}

export async function runWeaponBench(output: string) {
    const ids = Object.keys(WEAPON_DEFINITIONS) as WeaponId[];
    const run = () => profiles.flatMap(profile => ids.flatMap(id =>
        [EnemyType.GRUNT, EnemyType.TANK, EnemyType.BOSS].flatMap(type => [1, 4].map(count => measure(id, profile, type, count)))));
    const results = run();
    if (JSON.stringify(results) !== JSON.stringify(run())) throw new Error('Weapon bench is not repeatable');
    const runFuture = () => ids.flatMap(id => [1, 6, 12, 40, 100].flatMap(hp => [0, .5].map(armor =>
        measure(id, profiles[0], EnemyType.GRUNT, 1, hp, armor))));
    const futureTargets = runFuture();
    if (JSON.stringify(futureTargets) !== JSON.stringify(runFuture())) throw new Error('Future target fixture is not repeatable');
    const sources = ['src/gameplay/weapons.ts', 'src/gameplay/WeaponState.ts', 'src/entities/weapon/WeaponFactory.ts',
        'src/entities/weapon/ProjectileFactory.ts', 'src/systems/Player/PlayerWeaponController.ts',
        'src/systems/CollisionSystem.ts', 'src/entities/enemy/Enemy.ts', 'src/entities/enemy/enemyConfigs.ts'];
    const report = {
        schemaVersion: 1,
        sourceHashes: Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
        methodology: { durationSeconds: seconds, simulationHz: 60, arena: [1920, 1080], player: [100, 360],
            targetPositions: 'x=250+52*i, y=360; anchored; dead target replaced next tick', repeats: 2, identicalRepeats: true,
            profiles, achievementRewards: [], bonuses: [],
            limitations: ['Controlled weapon fixture, not survival or hero ranking.',
                'Anchored enemies: movement and pushback deliberately suppressed; actual collision, damage, status and ammo logic used.',
                'One and four targets along firing line; favors piercing and area weapons; no aim error or pickup drops.',
                '60-second finite-ammo run; no pistol fallback; final in-flight damage beyond horizon excluded.',
                'Each weapon-focused profile allocates arsenal budget to only the tested category, not every category at once.',
                'Post-BUG-005-fix measurement; source hashes identify implementation. Cadence is measured at 60 Hz, never inferred from nominal interval.',
                'Uses real PlayerWeaponController including catch-up. Extreme cadence rows separately test speed 8.736 (1.3*1.4*1.2*4) with refills; not a normal profile.',
                'Cadence-only rows refill ammunition to isolate speed; they are not finite-ammo damage rows.'] },
        futureTargetMethodology: 'Hypothetical HP fixtures retain grunt radius 25. Synthetic 50% uniform damage reduction applies equally to direct and status damage; it is not live armor. No enemy outgoing-damage, mobility, armor-type or resistance simulation. These rows must not be presented as implemented enemy behavior.',
        cadence: ids.flatMap(id => [1, 1.1, 1.15, 1.3, 1.68].map(speed => cadence(id, speed))), results, futureTargets,
        extremeCadence: ids.map(id => cadence(id, 1.3 * 1.4 * 1.2 * 4)),
    };
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    const flame = WEAPON_DEFINITIONS.flamethrower;
    const originalInterval = flame.shotIntervalMs;
    const measureFlame = () => [65, 130].flatMap(interval => {
        Object.assign(flame, { shotIntervalMs: interval });
        return [100, 200].flatMap(initialAmmo => [EnemyType.GRUNT, EnemyType.TANK, EnemyType.BOSS].flatMap(type =>
            [1, 4].map(count => ({ intervalMs: interval, initialAmmo, ...measure('flamethrower', profiles[0], type, count, undefined, 0, initialAmmo) })))
            .concat([1, 4].map(count => ({ intervalMs: interval, initialAmmo,
                ...measure('flamethrower', profiles[0], EnemyType.GRUNT, count, 100, 0, initialAmmo) }))));
    });
    try {
        const flameResults = measureFlame();
        if (JSON.stringify(flameResults) !== JSON.stringify(measureFlame())) throw new Error('Flame candidate is not repeatable');
        await writeFile(dirname(output) + '/flame-candidate.json', JSON.stringify({
            methodology: { ...report.methodology, profiles: [profiles[0]],
                candidate: 'Benchmark-only in-memory interval override: 65 ms versus 130 ms; burnDps remains 4; no on-disk gameplay constants changed.',
                ammo: '200 generic pickup fuel; 100 actual half-mutant starting fuel. No hero ability active or incoming damage.' },
            results: flameResults,
        }, null, 2) + '\n');
    } finally { Object.assign(flame, { shotIntervalMs: originalInterval }); }
    await runMovingFlame(dirname(output) + '/flame-moving-candidate.json');
    console.log(`Weapon balance: ${results.length} scenarios, two identical runs, ${report.cadence.length} cadence rows -> ${output}`);
}
