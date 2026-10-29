import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyArrivalQueue } from '../src/gameplay/EnemyArrivalQueue';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType as E } from '../src/entities/enemy/EnemyType';

test('opening arrivals preserve ten enemies while filling the gap before the next wave', () => {
    for (const roll of [0, .3, .7, .999]) {
        const queue = new EnemyArrivalQueue(() => roll);
        const roster = Array.from({ length: 10 }, () => new Enemy(-65, 400, E.GRUNT));
        queue.schedule(roster, 3000, 6000);
        assert.equal(queue.release(2999).length, 0);
        const groups: Enemy[][] = [];
        for (let time = 3000; time <= 9000; time++) {
            const group = queue.release(time);
            if (group.length) groups.push(group);
        }
        assert.ok(groups.length >= 3);
        assert.ok(groups.every(group => group.length >= 2 && group.length <= 6));
        assert.deepEqual(groups.flat(), roster);
        assert.equal(queue.release(10000).length, 0);
    }
});

test('bug pairs and trios are released together without dropping mixed roster enemies', () => {
    const queue = new EnemyArrivalQueue(() => .5);
    const roster = [E.GRUNT, E.GRUNT, E.BUG, E.BUG, E.BUG, E.BUG, E.BUG, E.TANK]
        .map(type => new Enemy(-65, 400, type));
    queue.schedule(roster, 10000, 4500);
    const released: Enemy[] = [];
    const bugGroups: number[] = [];
    for (let time = 10000; time <= 14500; time++) {
        const group = queue.release(time);
        released.push(...group);
        const bugs = group.filter(enemy => enemy.type === E.BUG).length;
        if (bugs) bugGroups.push(bugs);
    }
    assert.deepEqual(bugGroups, [3, 2]);
    assert.deepEqual(released, roster);
});

test('a large update releases every due group once and preserves later groups', () => {
    const queue = new EnemyArrivalQueue(() => .2);
    const first = Array.from({ length: 10 }, () => new Enemy(-65, 400, E.GRUNT));
    const second = Array.from({ length: 10 }, () => new Enemy(1065, 400, E.GRUNT));
    queue.schedule(first, 3000, 6000);
    queue.schedule(second, 10000, 4500);
    assert.deepEqual(queue.release(9000), first);
    assert.equal(queue.release(9999).length, 0);
    assert.deepEqual(queue.release(14500), second);
    assert.equal(queue.release(20000).length, 0);
});
