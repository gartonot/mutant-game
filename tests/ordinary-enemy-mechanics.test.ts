import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType, isBossType } from '../src/entities/enemy/EnemyType';
import { Player } from '../src/entities/player/Player';
import { OrdinaryEnemyMechanics } from '../src/gameplay/OrdinaryEnemyMechanics';
const noop = { applySlow() {} };

test('reference pistol and rifle shot counts preserve small prey and chunky enemies', () => {
    for (const [type, damage, shots] of [[EnemyType.BUG, 1, 1], [EnemyType.LEECH, 1, 1], [EnemyType.BEETLE, 2.5, 3], [EnemyType.TANK, 2.5, 8]] as const) {
        const enemy = new Enemy(0, 0, type);
        for (let i = 0; i < shots - 1; i++) enemy.receiveDamage(damage);
        assert.equal(enemy.isDead, false, `${type} died too early`);
        enemy.receiveDamage(damage); assert.equal(enemy.isDead, true);
        assert.equal(enemy.deathBurst, undefined, `${type} should not spray blood`);
    }
});

test('fat body attracts zombies and requires five feeding hits before a single green pop', () => {
    const mechanics = new OrdinaryEnemyMechanics(), player = new Player(400, 0);
    const fat = new Enemy(0, 0, EnemyType.TANK), eater = new Enemy(45, 0);
    fat.receiveDamage(100); mechanics.onDeath(fat); mechanics.onDeath(fat);
    assert.equal(mechanics.corpseCount, 1);
    for (let i = 0; i < 4; i++) mechanics.update(650, [eater], player, noop);
    assert.equal(mechanics.corpseCount, 1);
    assert.equal(eater.movementLocked, true); assert.equal(eater.contactDisabled, true);
    mechanics.update(650, [eater], player, noop);
    assert.equal(mechanics.corpseCount, 0); assert.equal(mechanics.greenMarkCount, 1);
    mechanics.update(16, [eater], player, noop);
    assert.equal(eater.movementLocked, false); assert.equal(eater.contactDisabled, false);
});

test('only nearby living slower applies contact slow and fear cancels its attack', () => {
    const mechanics = new OrdinaryEnemyMechanics(), player = new Player(0, 0);
    const slower = new Enemy(10, 0, EnemyType.SLOWER);
    let calls = 0;
    const callbacks = { applySlow(ms: number, factor: number) { assert.equal(ms, 1000); assert.equal(factor, .68); calls++; } };
    mechanics.update(16, [slower], player, callbacks); assert.equal(calls, 1);
    slower.applyFear(1000); mechanics.update(16, [slower], player, callbacks); assert.equal(calls, 1);
});

test('spitter glob hits player across a large simulation step and disappears', () => {
    const mechanics = new OrdinaryEnemyMechanics(), player = new Player(220, 0);
    const spitter = new Enemy(0, 0, EnemyType.SPITTER);
    mechanics.update(900, [spitter], player, noop);
    assert.equal(player.currentHp, 98); assert.equal(mechanics.projectileCount, 0);
    assert.equal(spitter.movementLocked, true);
});

test('jumper commits to telegraphed position, permitting a dodge', () => {
    const mechanics = new OrdinaryEnemyMechanics(), player = new Player(160, 0);
    const jumper = new Enemy(0, 0, EnemyType.JUMPER);
    mechanics.update(16, [jumper], player, noop);
    player.y = 200;
    mechanics.update(380, [jumper], player, noop);
    mechanics.update(420, [jumper], player, noop);
    assert.equal(jumper.x, 160); assert.equal(jumper.y, 0); assert.equal(player.currentHp, 100);
    mechanics.update(450, [jumper], player, noop);
    mechanics.update(16, [jumper], player, noop); assert.equal(jumper.movementLocked, false);
});

test('all boss variants support encounter health, invulnerability and contact suppression', () => {
    for (const type of [EnemyType.BOSS, EnemyType.STEROID, EnemyType.TENTACLE, EnemyType.WORM]) {
        assert.ok(isBossType(type));
        const boss = new Enemy(0, 0, type); boss.setMaxHealth(160);
        boss.invulnerable = true; boss.receiveDamage(99); assert.equal(boss.currentHealth, 160);
        boss.invulnerable = false; boss.receiveDamage(10); assert.equal(boss.currentHealth, 150);
        boss.contactDisabled = true; assert.equal(boss.canDamage(1000), false);
        boss.setTarget(100, 100); boss.movementLocked = true; boss.update(16); assert.equal(boss.x, 0);
    }
});

test('clear removes ordinary encounter objects and permits reused enemies to die again', () => {
    const mechanics = new OrdinaryEnemyMechanics(); const bug = new Enemy(0, 0, EnemyType.BUG);
    bug.receiveDamage(1); mechanics.onDeath(bug); assert.equal(mechanics.greenMarkCount, 1);
    mechanics.clear(); assert.equal(mechanics.greenMarkCount, 0); assert.equal(mechanics.projectileCount, 0); assert.equal(mechanics.corpseCount, 0);
});

test('death or fear interrupts a prepared jump without delayed damage', () => {
    for (const interrupt of ['death', 'fear'] as const) {
        const mechanics = new OrdinaryEnemyMechanics(), player = new Player(150, 0);
        const jumper = new Enemy(0, 0, EnemyType.JUMPER);
        mechanics.update(16, [jumper], player, noop);
        if (interrupt === 'death') { jumper.receiveDamage(100); mechanics.onDeath(jumper); }
        else jumper.applyFear(1000);
        mechanics.update(420, [jumper], player, noop);
        assert.equal(player.currentHp, 100);
        if (interrupt === 'fear') {
            assert.equal(jumper.movementLocked, false);
            assert.equal(jumper.contactDisabled, false);
            assert.equal(jumper.visualLift, 0);
            assert.equal(jumper.renderScale, 1);
        }
    }
});

test('corpse and green ground stain persist without an invented expiry timer', () => {
    const mechanics = new OrdinaryEnemyMechanics(), player = new Player(500, 500);
    const fat = new Enemy(0, 0, EnemyType.TANK), bug = new Enemy(100, 100, EnemyType.BUG);
    fat.receiveDamage(100); bug.receiveDamage(1);
    mechanics.onDeath(fat); mechanics.onDeath(bug);
    mechanics.update(60000, [], player, noop);
    assert.equal(mechanics.corpseCount, 1); assert.equal(mechanics.greenMarkCount, 1);
});
