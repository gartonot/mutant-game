import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pickup } from '../src/gameplay/Pickups';

const viewport = { width: 800, height: 600 };
const drop = (x = 200, y = 200, px = 500, py = 200, multiplier = 1) =>
    new Pickup('ammo', x, y, px, py, 20, multiplier, viewport);

test('pickups fly 2.5 enemy diameters toward the player', () => {
    const item = drop(200, 200, 500, 600);
    item.update(400);
    assert.equal(item.x, 260);
    assert.equal(item.y, 280);
    assert.equal(item.inFlight, false);
});

test('pickup flight stops at a nearby player and handles coincident positions', () => {
    const nearby = drop(200, 200, 220, 200);
    nearby.update(400);
    assert.equal(nearby.x, 220);
    const coincident = drop(200, 200, 200, 200);
    coincident.update(400);
    assert.equal(coincident.x, 200);
    assert.equal(coincident.y, 200);
});

test('pickup landing stays within screen and adjusts after resize', () => {
    const item = drop(790, 590, 900, 700);
    item.update(400);
    assert.equal(item.x, 784);
    assert.equal(item.y, 584);
    item.update(1, { width: 300, height: 200 });
    assert.equal(item.x, 284);
    assert.equal(item.y, 184);
});

test('pickup lifetime excludes flight and respects duration multiplier', () => {
    const item = drop(200, 200, 500, 200, 2);
    item.update(30399);
    assert.equal(item.expired, false);
    item.update(1);
    assert.equal(item.expired, true);
});

test('pickups require landed contact with a living player', () => {
    const item = drop(200, 200, 200, 200);
    const player = { x: 200, y: 200, radius: 20, currentHp: 100 };
    assert.equal(item.canCollect(player), false);
    item.update(399);
    assert.equal(item.canCollect(player), false);
    item.update(1);
    assert.equal(item.canCollect(player), true);
    assert.equal(item.canCollect({ ...player, currentHp: 0 }), false);
    assert.equal(item.canCollect({ ...player, x: 250 }), false);
    item.update(15000);
    assert.equal(item.canCollect(player), false);
});
