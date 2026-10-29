import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player/Player';

test('enemy slow and capture compose independently with buffs and expire in simulation time', () => {
    const p = new Player();
    p.activateBonus('moveSpeed');
    p.applyEnemySlow(1000, .68);
    assert.equal(p.enemyMoveFactor, .68);
    p.applyEnemyRoot(100);
    assert.equal(p.enemyMoveFactor, 0);
    p.updateEnemyEffects(0);
    assert.equal(p.enemyMoveFactor, 0);
    p.updateEnemyEffects(100);
    assert.equal(p.enemyMoveFactor, .68);
    assert.equal(p.pickupMoveSpeed, 1.5);
    p.updateEnemyEffects(900);
    assert.equal(p.enemyMoveFactor, 1);
    p.applyEnemySlow(500, .8);
    assert.equal(p.enemyMoveFactor, .8, 'expired stronger slow does not leak into a later hit');
    assert.equal(new Player().enemyMoveFactor, 1);
});
