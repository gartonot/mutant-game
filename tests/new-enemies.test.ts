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
    assert.equal(new Enemy(0, 0, EnemyType.BOSS).damage, 2, 'preserve actual existing boss contact');
});

test('bugs weave to both sides while closing in and ordinary enemies keep a straight path', () => {
    for (const type of [EnemyType.BUG, EnemyType.GRUNT]) {
        const enemy = new Enemy(0, 0, type); enemy.setTarget(10000, 0);
        let leftSteps = 0, rightSteps = 0;
        for (let frame = 0; frame < 84; frame++) {
            const previousX = enemy.x, previousY = enemy.y;
            enemy.update(1000 / 60);
            assert.ok(enemy.x > previousX, 'each step advances toward the distant target');
            if (enemy.y - previousY > .1) rightSteps++;
            if (enemy.y - previousY < -.1) leftSteps++;
        }
        if (type === EnemyType.BUG) {
            assert.ok(leftSteps > 10 && rightSteps > 10, 'zigzag alternates lateral direction');
            assert.ok(enemy.x > 190, 'fast pursuit retains forward progress through the turns');
        } else assert.equal(enemy.y, 0, 'zigzag is restricted to bugs');
    }
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
    assert.equal(normal.radius, 5.5);
    assert.equal(normal.checkCollision(normal.x + 5, normal.y, 0), true);
    assert.equal(normal.checkCollision(normal.x + 6, normal.y, 0), false);
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

test('small bugs are fragile, reinforced zombies need six ordinary damage', () => {
    const bug = new Enemy(0, 0, EnemyType.BUG); bug.receiveDamage(1); assert.ok(bug.isDead);
    const tank = new Enemy(0, 0, EnemyType.TANK); tank.receiveDamage(5); assert.equal(tank.isDead, false);
    tank.receiveDamage(1); assert.ok(tank.isDead);
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
