import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EnemyType, isBossType } from '../src/entities/enemy/EnemyType';
import { WaveConfigs, SURVIVAL_WAVE_COUNT, BOSS_SEQUENCE } from '../src/systems/WaveSystem/WaveConfig';
import { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';
import { ENEMY_CONFIGS } from '../src/entities/enemy/enemyConfigs';

const viewport = () => ({ width: 800, height: 600 });
const roster = (wave: number) => WaveConfigs[wave - 1].composition!;

test('opening keeps ten enemies per wave, starting with ordinary zombies', () => {
    for (let wave = 1; wave < 12; wave++) {
        assert.equal(roster(wave).length, 10, `wave ${wave}`);
        assert.equal(WaveConfigs[wave - 1].count, 10);
        assert.ok(roster(wave).filter(type => type === EnemyType.GRUNT).length >= 7);
        if (wave <= 3) assert.ok(roster(wave).every(type => type === EnemyType.GRUNT));
    }
});

test('opening zombies arrive in variable compact groups with uneven gaps', () => {
    const layouts: string[] = [];
    for (const roll of [0, .3, .55, .8, .99]) {
        const enemies = new WaveSystem({ random: () => roll, viewport }).spawnWave();
        assert.equal(enemies.length, 10);
        const side = (e: typeof enemies[number]) => e.x < 0 ? 'left' : e.x > 800 ? 'right' : e.y < 0 ? 'top' : 'bottom';
        const horizontal = enemies[0].x < 0 || enemies[0].x > 800;
        const along = enemies.filter(e => side(e) === side(enemies[0])).map(e => horizontal ? e.y : e.x);
        assert.ok(Math.max(...along) - Math.min(...along) > 80, 'main entry front has visible width');
        for (const e of enemies) {
            const depth = e.x < 0 ? -e.x : e.x > 800 ? e.x - 800 : e.y < 0 ? -e.y : e.y - 600;
            assert.ok(depth >= 40 && depth <= 64, 'no distant hidden queue to fake timing');
        }        layouts.push(JSON.stringify(enemies.map(e => [e.x, e.y])));
    }
    assert.equal(new Set(layouts).size, layouts.length, 'different rolls produce different arrival patterns');
});
test('six minute waves introduce enabled ordinary roles and diversify before first boss', () => {
    assert.equal(WaveConfigs.length, SURVIVAL_WAVE_COUNT);
    const first = (type: EnemyType) => WaveConfigs.findIndex(rule => rule.composition!.includes(type)) + 1;
    assert.equal(first(EnemyType.BUG), 4);
    assert.equal(first(EnemyType.TANK), 6);
    assert.equal(first(EnemyType.RUNNER), 8);
    assert.ok(first(EnemyType.SLOWER) < 12);
    for (const type of [EnemyType.ARMORED, EnemyType.CYAN, EnemyType.BEETLE, EnemyType.SPITTER, EnemyType.JUMPER]) {
        assert.ok(first(type) > 0 && first(type) < 24, type);
    }
    assert.ok(WaveConfigs.every(rule => !rule.types.some(isBossType)));
    assert.ok(WaveConfigs.every(rule => !rule.types.includes(EnemyType.LEECH) && !rule.composition!.includes(EnemyType.LEECH)));
});

test('exact wave composition is independent of random side and coordinates', () => {
    for (const roll of [0, .5, .9999]) {
        const waves = new WaveSystem({ random: () => roll, viewport });
        for (let wave = 1; wave <= SURVIVAL_WAVE_COUNT; wave++) {
            const enemies = waves.spawnWave(true);
            assert.deepEqual(enemies.map(e => e.type), roster(wave));
        }
        assert.deepEqual(waves.spawnWave(), []);
    }
});

test('minute escorts and following recovery packs contain no control or elite enemies', () => {
    assert.ok(WaveConfigs.every(rule => rule.count <= 11));
    for (const wave of [12, 13, 24, 25, 36, 37, 48, 49, 60, 61]) {
        assert.equal(roster(wave).length, 5);
        assert.ok(roster(wave).every(type => type === EnemyType.GRUNT || type === EnemyType.BUG));
    }
});

test('boss queue waits for a free minute, retains order and includes dying occupancy', () => {
    const waves = new WaveSystem({ random: () => .4, viewport });
    let boss: ReturnType<WaveSystem['spawnWave']>[number] | undefined;
    const appearances: { wave: number; type: EnemyType }[] = [];
    for (let wave = 1; wave <= 72; wave++) {
        // First boss remains alive at 120 seconds; dies between minute marks.
        if (wave === 26) boss!.receiveDamage(9999);
        // Second dies, but its explosion is still in progress at 240 seconds.
        if (wave === 47) boss!.receiveDamage(9999);
        const enemies = waves.spawnWave(wave === 48);
        const found = enemies.find(e => isBossType(e.type));
        if (found) { boss = found; appearances.push({ wave, type: found.type }); }
    }
    assert.deepEqual(appearances, [
        { wave: 12, type: EnemyType.BOSS }, { wave: 36, type: EnemyType.STEROID }, { wave: 60, type: EnemyType.TENTACLE },
    ]);
});

test('all four bosses can appear in order, with no fifth repeat or victory spawn', () => {
    const waves = new WaveSystem({ random: () => 0, viewport });
    const types: EnemyType[] = [];
    for (let wave = 1; wave <= 72; wave++) {
        for (const enemy of waves.spawnWave()) if (isBossType(enemy.type)) { types.push(enemy.type); enemy.receiveDamage(9999); }
    }
    assert.deepEqual(types, BOSS_SEQUENCE);
});

test('default packs favor horizontal flanks and keep each half clustered outside arena', () => {
    let horizontal = 0;
    for (let n = 0; n < 100; n++) {
        const roll = (n + .5) / 100;
        const enemies = new WaveSystem({ random: () => roll, viewport }).spawnWave();
        if (enemies[0].x < 0 || enemies[0].x > 800) horizontal++;
        assert.ok(enemies.every(e => e.x < 0 || e.x > 800 || e.y < 0 || e.y > 600));
        assert.ok(Math.hypot(enemies[0].x - enemies[1].x, enemies[0].y - enemies[1].y) < 70);
    }
    assert.equal(horizontal, 80);
});

test('bugs enter survival in compact pairs or trios, never as a lone flank spawn', () => {
    for (const roll of [.1, .6, .85, .95]) {
        const waves = new WaveSystem({ random: () => roll, viewport });
        for (let wave = 1; wave <= SURVIVAL_WAVE_COUNT; wave++) {
            const bugs = waves.spawnWave(true).filter(enemy => enemy.type === EnemyType.BUG);
            const byEdge = new Map<string, typeof bugs>();
            for (const bug of bugs) {
                const edge = bug.x < 0 ? 'left' : bug.x > 800 ? 'right' : bug.y < 0 ? 'top' : 'bottom';
                const group = byEdge.get(edge) ?? [];
                group.push(bug);
                byEdge.set(edge, group);
            }
            for (const group of byEdge.values()) {
                assert.ok(group.length === 2 || group.length === 3, `wave ${wave}: ${group.length} bugs`);
                for (const bug of group) assert.ok(Math.hypot(bug.x - group[0].x, bug.y - group[0].y) <= 76);
            }
        }
    }
});

test('custom rules still select random types and repeat, with exact mixes opt-in', () => {
    const waves = new WaveSystem({ rules: [{ types: [EnemyType.GRUNT, EnemyType.RUNNER], count: 2 }], random: () => .99, viewport });
    for (let i = 0; i < 50; i++) assert.ok(waves.spawnWave().every(e => e.speed === ENEMY_CONFIGS[EnemyType.RUNNER].speed));
    assert.throws(() => new WaveSystem({ rules: [{ types: [EnemyType.GRUNT], count: 2, composition: [EnemyType.GRUNT] }] }));
});

test('vertical packs use resized arena edges and bosses remain outside before entry', () => {
    let height = 600;
    const waves = new WaveSystem({ random: () => .95, viewport: () => ({ width: 800, height }) });
    for (let wave = 1; wave <= 12; wave++) {
        if (wave === 5) height = 180;
        const spawned = waves.spawnWave();
        assert.ok(spawned.every(e => e.y < 0 || e.y > height));
        assert.ok(spawned.every(e => e.x >= 35 && e.x <= 765));
        if (wave === 12) assert.equal(spawned.filter(e => isBossType(e.type)).length, 1);
    }
});
