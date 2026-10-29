import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { ENEMY_CONFIGS } from '../src/entities/enemy/enemyConfigs';

test('enemy roles use configured movement, collider and contact damage', () => {
    for (const type of Object.keys(ENEMY_CONFIGS) as EnemyType[]) {
        const config = ENEMY_CONFIGS[type];
        const enemy = new Enemy(100, 100, type); enemy.setTarget(1000, 100);
        assert.equal(enemy.damage, config.damageToPlayer); assert.equal(enemy.radius, config.radius);
        enemy.update(); assert.ok(Math.abs(Math.hypot(enemy.x - 100, enemy.y - 100) - config.speed) < 1e-9);
        assert.equal(enemy.canDamage(0), true); assert.equal(enemy.canDamage(100), false);
        enemy.applyFear(1000); assert.equal(enemy.canDamage(1000), false);
    }
    assert.equal(new Enemy(0, 0, EnemyType.BOSS).damage, 5, 'boss contact is stronger than ordinary zombies');
});

test('bugs weave to both sides while closing in and ordinary enemies keep a straight path', () => {
    for (const type of [EnemyType.BUG, EnemyType.GRUNT]) {
        const enemy = new Enemy(0, 0, type); enemy.setTarget(10000, 0);
        let leftSteps = 0, rightSteps = 0, pathLength = 0, maxDeviation = 0;
        for (let frame = 0; frame < 84; frame++) {
            const previousX = enemy.x, previousY = enemy.y;
            enemy.update(1000 / 60);
            pathLength += Math.hypot(enemy.x - previousX, enemy.y - previousY);
            maxDeviation = Math.max(maxDeviation, Math.abs(enemy.y));
            assert.ok(enemy.x > previousX, 'each step advances toward the distant target');
            if (enemy.y - previousY > .1) rightSteps++;
            if (enemy.y - previousY < -.1) leftSteps++;
        }
        if (type === EnemyType.BUG) {
            assert.ok(leftSteps > 10 && rightSteps > 10, 'zigzag alternates lateral direction');
            assert.ok(enemy.x > 140, 'wide turns still close the distance');
            assert.ok(maxDeviation > 60, 'wide zigzag travels visibly across the approach path');
            assert.ok(Math.abs(pathLength - 84 * ENEMY_CONFIGS.bug.speed) < 1e-8, 'actual travel speed stays unchanged');
        } else assert.equal(enemy.y, 0, 'zigzag is restricted to bugs');
    }
});

test('bug packs spread across both flanks and eventually close for an attack', () => {
    const bugs = Array.from({ length: 12 }, (_, i) => new Enemy(0, i * 5 - 30, EnemyType.BUG));
    let above = false, below = false, direct = false;
    for (const bug of bugs) {
        bug.setTarget(650, 0);
        let reached = false;
        for (let frame = 0; frame < 1800; frame++) {
            bug.update();
            if (frame === 100) {
                above ||= bug.y < -100; below ||= bug.y > 100; direct ||= Math.abs(bug.y) < 65;
            }
            if (Math.hypot(bug.x - 650, bug.y) < bug.radius + 15) { reached = true; break; }
        }
        assert.ok(reached, 'flanking must finish with an approach, not endless orbiting');
    }
    assert.ok(above && below && direct, 'a group contains direct and both side approaches');
});

test('bug movement responds to status effects without losing its smaller hitbox', () => {
    const normal = new Enemy(0, 0, EnemyType.BUG);
    const slowed = new Enemy(0, 0, EnemyType.BUG);
    const burning = new Enemy(0, 0, EnemyType.BUG);
    slowed.applyEffect({ slowMs: 1000, slowFactor: .5 });
    burning.applyEffect({ burnMs: 1000, burnDps: 0 });
    for (const enemy of [normal, slowed, burning]) {
        enemy.setTarget(10000, 0); enemy.update();
    }
    const distance = (enemy: Enemy) => Math.hypot(enemy.x, enemy.y);
    assert.ok(Math.abs(distance(slowed) / distance(normal) - .5) < 1e-9);
    assert.ok(Math.abs(distance(burning) / distance(normal) - 1.35) < 1e-9);
    assert.equal(normal.radius, 13);
    assert.equal(normal.checkCollision(normal.x + 12, normal.y, 0), true);
    assert.equal(normal.checkCollision(normal.x + 14, normal.y, 0), false);
});

test('armor reduces direct, burning and acid damage uniformly and preserves death origin', () => {
    for (const effect of [undefined, 'burn', 'acid'] as const) {
        const enemy = new Enemy(0, 0, EnemyType.ARMORED);
        if (!effect) enemy.receiveDamage(12, 0, 0);
        else {
            enemy.applyEffect(effect === 'burn' ? { burnMs: 1000, burnDps: 12 } : { acidMs: 1000, acidDps: 12 });
            enemy.update(1000);
        }
        assert.equal(enemy.isDead, false, '12 raw damage leaves 1 HP behind armor');
        enemy.receiveDamage(1); assert.equal(enemy.isDead, false);
        enemy.receiveDamage(1); assert.equal(enemy.isDead, true);
        const burst = enemy.deathBurst; enemy.receiveDamage(100, 1);
        assert.deepEqual(enemy.deathBurst, burst);
    }
});

test('small bugs are fragile, fat zombies need eight base rifle hits', () => {
    const bug = new Enemy(0, 0, EnemyType.BUG); bug.receiveDamage(1); assert.ok(bug.isDead);
    const tank = new Enemy(0, 0, EnemyType.TANK); tank.receiveDamage(17.5); assert.equal(tank.isDead, false);
    tank.receiveDamage(2.5); assert.ok(tank.isDead);
});

test('fat zombies ignore ordinary bullet knockback and barely move under heavy fire', () => {
    const tank = new Enemy(0, 0, EnemyType.TANK);
    for (const force of [0, 3, 5, 10, 16, 20, 25, 28, -35, NaN, Infinity]) {
        tank.receiveDamage(.1, 0, force);
        assert.equal(tank.x, 0);
        assert.equal(tank.y, 0);
    }
    for (let pellet = 0; pellet < 5; pellet++) tank.receiveDamage(.1, 0, 35);
    assert.ok(Math.abs(tank.x - .5) < 1e-9, 'an entire shotgun volley moves the body just half a pixel');
    tank.receiveDamage(.1, Math.PI / 2, 85);
    assert.ok(tank.y > 0 && tank.y <= .3, 'even a pulse impulse only nudges the heavy body');
    const previousY = tank.y;
    tank.receiveDamage(.1, Math.PI / 2, 10000);
    assert.ok(Math.abs(tank.y - previousY - .3) < 1e-9, 'large impulses remain capped');
    tank.receiveDamage(.1, NaN, 35);
    assert.ok(Number.isFinite(tank.x) && Number.isFinite(tank.y));
    assert.ok(tank.currentHealth < tank.maxHealth, 'resistance does not prevent weapon damage');

    const grunt = new Enemy(0, 0, EnemyType.GRUNT);
    grunt.receiveDamage(.1, 0, 20);
    assert.equal(grunt.x, 20, 'ordinary zombie knockback is unchanged');
});

test('armor configuration cannot amplify damage or create invulnerability', () => {
    const config = ENEMY_CONFIGS[EnemyType.ARMORED], original = config.damageReduction;
    try {
        for (const value of [-1, NaN, Infinity]) {
            config.damageReduction = value;
            const enemy = new Enemy(0, 0, EnemyType.ARMORED); enemy.receiveDamage(10); assert.ok(enemy.isDead);
        }
        config.damageReduction = 2;
        const enemy = new Enemy(0, 0, EnemyType.ARMORED); enemy.receiveDamage(51); assert.ok(enemy.isDead);
    } finally { config.damageReduction = original; }
});
