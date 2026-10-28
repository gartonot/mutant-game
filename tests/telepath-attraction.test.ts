import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pickup } from '../src/gameplay/Pickups';
import { TelepathAttraction } from '../src/gameplay/TelepathAttraction';

const viewport = { width: 800, height: 600 };
function landed(kind: 'health' | 'ammo' | 'weapon' = 'health', x = 100) {
    const item = new Pickup(kind, x, 100, x, 100, 20, 1, viewport);
    item.update(400);
    return item;
}

test('telepath needs three uninterrupted simulation seconds over the same landed bonus', () => {
    const attraction = new TelepathAttraction(), first = landed(), second = landed('ammo', 200);
    const items = [first, second];
    attraction.update(2999, items, first, true);
    assert.equal(first.attracted, false);
    attraction.update(0, items, first, true);
    assert.equal(first.attracted, false);
    attraction.update(1, items, { x: 700, y: 500 }, true);
    assert.equal(first.attractionProgress, 0);
    attraction.update(2999, items, first, true);
    attraction.update(1, items, second, true);
    assert.equal(first.attracted, false);
    attraction.update(2998, items, second, true);
    assert.equal(second.attracted, false);
    attraction.update(1, items, second, true);
    assert.equal(second.attracted, true);
});

test('only telepath attracts live landed bonuses, excluding weapons', () => {
    const attraction = new TelepathAttraction(), item = landed();
    attraction.update(3000, [item], item, false);
    assert.equal(item.attracted, false);
    const weapon = landed('weapon');
    attraction.update(3000, [weapon], weapon, true);
    assert.equal(weapon.attracted, false);
    const flying = new Pickup('health', 100, 100, 100, 100, 20, 1, viewport);
    attraction.update(3000, [flying], flying, true);
    assert.equal(flying.attracted, false);
    item.update(15000);
    attraction.update(3000, [item], item, true);
    assert.equal(item.attracted, false);
});

test('launched bonus follows moving hero after cursor leaves, collects normally and keeps its lifetime', () => {
    const attraction = new TelepathAttraction(), item = landed();
    attraction.update(3000, [item], item, true);
    const player = { x: 400, y: 100, radius: 20, currentHp: 100 };
    attraction.update(500, [item], { x: 700, y: 500 }, true);
    item.update(250, viewport, player);
    assert.equal(item.x, 250);
    assert.equal(item.canCollect(player), false);
    player.x = 550;
    item.update(500, viewport, player);
    assert.equal(item.x, 550);
    assert.equal(item.canCollect(player), true);
    item.update(1, viewport, player);
    assert.equal(item.x, 550, 'normal drop trajectory cannot snap the bonus back');
    item.update(15000, viewport, player);
    assert.equal(item.expired, true);
    assert.equal(item.canCollect(player), false);
});
