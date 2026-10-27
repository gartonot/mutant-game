import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCharacter } from '../src/gameplay/CharacterFactory';
import { defaultLoadout } from '../src/gameplay/characters';

test('regeneration heals fractional HP once per simulation second and caps at character maximum', () => {
    const { player } = createCharacter(defaultLoadout('half-mutant'));
    player.takeDamage(10);
    player.updateRegeneration(999);
    assert.equal(player.currentHp, 110);
    player.updateRegeneration(1);
    assert.equal(player.currentHp, 110.3);
    player.updateRegeneration(2500);
    assert.ok(Math.abs(player.currentHp - 110.9) < 1e-9);
    player.updateRegeneration(500);
    assert.ok(Math.abs(player.currentHp - 111.2) < 1e-9);
    player.updateRegeneration(100000);
    assert.equal(player.currentHp, 120);
    assert.equal(player.damageTaken, 10);
});

test('regeneration respects fixed steps, never resurrects and starts with a fresh clock', () => {
    const { player } = createCharacter(defaultLoadout('witcher'));
    player.takeDamage(10);
    for (let tick = 0; tick < 60; tick++) player.updateRegeneration(1000 / 60);
    assert.ok(Math.abs(player.currentHp - 60.8) < 1e-9);
    player.takeDamage(100);
    player.updateRegeneration(10000);
    assert.equal(player.currentHp, 0);
    const fresh = createCharacter(defaultLoadout('witcher')).player;
    fresh.takeDamage(10);
    fresh.updateRegeneration(999);
    assert.equal(fresh.currentHp, 60);
    const neutral = createCharacter(defaultLoadout('mercenary')).player;
    neutral.takeDamage(10);
    neutral.updateRegeneration(10000);
    assert.equal(neutral.currentHp, 90);
});

test('future item duration multipliers reach the runtime without changing regeneration', () => {
    const fanatic = createCharacter(defaultLoadout('fanatic')).player;
    assert.equal(fanatic.bonusGroundDuration, 1.3);
    assert.equal(fanatic.bonusDuration, 1);
    const hunter = createCharacter(defaultLoadout('hunter')).player;
    assert.equal(hunter.bonusDuration, 1.25);
    assert.equal(hunter.bonusGroundDuration, 1);
});
