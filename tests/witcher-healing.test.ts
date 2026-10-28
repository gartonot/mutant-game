import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player/Player';
import { ExtendedCharacterAbilities } from '../src/gameplay/ExtendedCharacterAbilities';

function setup() {
    const player = new Player();
    player.character = 'witcher';
    player.maxHp = 70;
    player.currentHp = 20;
    player.regeneration = .8;
    const ability = new ExtendedCharacterAbilities(player, () => [], () => ({ x: 1000, y: 1000 }));
    return { player, ability };
}

function close(actual: number, expected: number) {
    assert.ok(Math.abs(actual - expected) < 1e-8, `expected ${expected}, got ${actual}`);
}

test('witcher heals only while swarm is active without enemies or aiming at the player', () => {
    const { player, ability } = setup();
    ability.update(1000);
    close(player.currentHp, 20);
    ability.activate();
    close(player.currentHp, 20);
    ability.update(125);
    close(player.currentHp, 20.375);
    // No simulation advance (including pause) must not heal or consume the duration.
    for (const delta of [0, -1, NaN, Infinity]) ability.update(delta);
    close(player.currentHp, 20.375);
    ability.update(5874);
    close(player.currentHp, 37.997);
    assert.equal(ability.isActive, true);
    ability.update(10000);
    close(player.currentHp, 38);
    assert.equal(ability.isActive, false);
    ability.update(10000);
    close(player.currentHp, 38);
});

test('swarm healing caps at max HP without banking overheal and adds to normal regeneration', () => {
    const { player, ability } = setup();
    player.currentHp = 69;
    ability.activate();
    ability.update(2000);
    assert.equal(player.currentHp, 70);
    player.currentHp = 30;
    ability.update(4000);
    close(player.currentHp, 42);
    player.updateRegeneration(6000);
    close(player.currentHp, 46.8);
});

test('swarm cancellation and death stop healing; a fresh activation gets its own duration', () => {
    const { player, ability } = setup();
    ability.activate();
    ability.update(1000);
    ability.dispose();
    ability.update(5000);
    close(player.currentHp, 23);
    ability.activate();
    ability.update(1000);
    close(player.currentHp, 26);
    player.currentHp = 0;
    ability.update(5000);
    assert.equal(player.currentHp, 0);
    assert.equal(ability.isActive, false);
    ability.activate();
    ability.update(6000);
    assert.equal(player.currentHp, 0);
    player.currentHp = 20;
    ability.activate();
    ability.update(6000);
    close(player.currentHp, 38);
});
