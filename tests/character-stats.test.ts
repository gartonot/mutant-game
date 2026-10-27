import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTER_DEFINITIONS } from '../src/gameplay/characters';
import { CHARACTER_IDS } from '../src/gameplay/ids';
import type { CharacterId } from '../src/gameplay/ids';
import { BASE_STATS, resolveStats } from '../src/gameplay/stats';
import type { CombatStats } from '../src/gameplay/stats';

test('all character passive stats match their documented bonuses and penalties', () => {
    const expected: Record<CharacterId, Partial<CombatStats>> = {
        destroyer: { explosionRadius: 1.5, speed: 4.5 },
        assassin: { maxHp: 80, attackSpeed: 1.3 },
        mercenary: {},
        'half-mutant': { maxHp: 120, regeneration: .3 },
        telepath: { attackSpeed: 1.15, speed: 5.75 },
        cyborg: { maxHp: 170, damage: 1.1 },
        goliath: { maxHp: 200 },
        fanatic: { speed: 6.5, bonusGroundDuration: 1.3 },
        nuclear: { maxHp: 120, damage: 1.25 },
        'silver-hunter': { damage: 1.1, bonusDuration: 1.25 },
        witcher: { maxHp: 70, speed: 5.5, regeneration: .8 },
        'plasma-nuclear': { maxHp: 120, damage: 1.25 },
        hunter: { attackSpeed: 1.1, bonusDuration: 1.25 },
        'unknown-white-outfit': {},
        'unknown-crossbow': {},
    };
    for (const id of CHARACTER_IDS) {
        const definition = CHARACTER_DEFINITIONS[id];
        assert.deepEqual(resolveStats(definition.baseStats, definition.modifiers), { ...BASE_STATS, ...expected[id] }, id);
        assert.deepEqual(definition.startingWeapons, ['pistol'], `${id}: starting equipment is unchanged`);
        assert.equal(definition.ability.status, ['destroyer', 'assassin', 'mercenary'].includes(id) ? 'active' : 'pending', `${id}: ability availability`);
    }
});

test('character penalties stack with flat health upgrades before percentages', () => {
    const definition = CHARACTER_DEFINITIONS.witcher;
    const stats = resolveStats(definition.baseStats, [...definition.modifiers,
        { stat: 'maxHp', operation: 'add', value: 20 },
        { stat: 'maxHp', operation: 'percent', value: .1 },
        { stat: 'regeneration', operation: 'add', value: .2 },
        { stat: 'regeneration', operation: 'percent', value: .5 },
    ]);
    assert.ok(Math.abs(stats.maxHp - 96) < 1e-10);
    assert.equal(stats.regeneration, 1.5);
    assert.equal(BASE_STATS.maxHp, 100);
    assert.equal(BASE_STATS.regeneration, 0);
});

test('radius and both future bonus durations use additive percentage stacking independently', () => {
    const stats = resolveStats(BASE_STATS, [
        { stat: 'explosionRadius', operation: 'percent', value: .5 },
        { stat: 'explosionRadius', operation: 'percent', value: .25 },
        { stat: 'bonusGroundDuration', operation: 'percent', value: .3 },
        { stat: 'bonusGroundDuration', operation: 'percent', value: .2 },
        { stat: 'bonusDuration', operation: 'percent', value: .25 },
        { stat: 'bonusDuration', operation: 'percent', value: .5 },
    ]);
    assert.equal(stats.explosionRadius, 1.75);
    assert.equal(stats.bonusGroundDuration, 1.5);
    assert.equal(stats.bonusDuration, 1.75);
    assert.equal(stats.speed, BASE_STATS.speed);
    assert.equal(stats.regeneration, 0);
});
