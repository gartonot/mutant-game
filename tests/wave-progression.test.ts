import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { WaveConfigs, SURVIVAL_WAVE_COUNT } from '../src/systems/WaveSystem/WaveConfig';
import { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';

const viewport = () => ({ width: 800, height: 600 });
const roster = (wave: number) => WaveConfigs[wave - 1].composition!;

test('survival introduces enemy roles separately without early elite spam', () => {
    assert.equal(WaveConfigs.length, SURVIVAL_WAVE_COUNT);
    const first = (type: EnemyType) => WaveConfigs.findIndex(rule => rule.composition!.includes(type)) + 1;
    assert.equal(first(EnemyType.BUG), 4);
    assert.equal(first(EnemyType.TANK), 6);
    assert.equal(first(EnemyType.RUNNER), 8);
    assert.equal(first(EnemyType.ARMORED), 18);
    assert.equal(roster(4).filter(t => t === EnemyType.BUG).length, 3);
    assert.equal(roster(8).filter(t => t === EnemyType.RUNNER).length, 1);
    assert.equal(roster(18).filter(t => t === EnemyType.ARMORED).length, 1);
    assert.ok(WaveConfigs.every(rule => !rule.types.includes(EnemyType.BOSS)));
});

test('exact wave composition cannot randomly turn into an elite-only pack', () => {
    for (const roll of [0, .5, .9999]) {
        const waves = new WaveSystem({ random: () => roll, viewport });
        for (let wave = 1; wave <= 47; wave++) {
            const enemies = waves.spawnWave();
            // Enemy type is deliberately private; this test inspects the constructor's roster contract.
            const types = enemies.map(e => (e as unknown as { type: EnemyType }).type);
            const expected = [...roster(wave)];
            if (wave % 12 === 0) expected.push(EnemyType.BOSS);
            assert.deepEqual(types, expected);
        }
        assert.deepEqual(waves.spawnWave(), []);
    }
});

test('wave pacing caps density and gives a lighter pack after every boss', () => {
    const minuteTotals = [0, 1, 2, 3].map(m => WaveConfigs.slice(m * 12, (m + 1) * 12).reduce((sum, rule) => sum + rule.count, 0));
    assert.ok(minuteTotals.every((total, i) => i === 0 || total > minuteTotals[i - 1]));
    assert.ok(minuteTotals.reduce((a, b) => a + b) <= 420);
    assert.ok(WaveConfigs.every(rule => rule.count <= 12));
    for (const wave of [13, 25, 37]) {
        assert.ok(WaveConfigs[wave - 1].count < WaveConfigs[wave - 3].count);
        assert.ok(!roster(wave).includes(EnemyType.ARMORED));
        assert.ok(!roster(wave).includes(EnemyType.RUNNER));
    }
});

test('custom rules still select random types and repeat, with exact mixes opt-in', () => {
    const waves = new WaveSystem({ rules: [{ types: [EnemyType.GRUNT, EnemyType.RUNNER], count: 2 }], random: () => .99, viewport });
    for (let i = 0; i < 50; i++) assert.ok(waves.spawnWave().every(e => e.speed === 2.1));
    assert.throws(() => new WaveSystem({ rules: [{ types: [EnemyType.GRUNT], count: 2, composition: [EnemyType.GRUNT] }] }));
});
