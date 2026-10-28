import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExtendedCharacterAbilities } from '../src/gameplay/ExtendedCharacterAbilities';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import type { CharacterId } from '../src/gameplay/ids';
import { planPlasmaTraps } from '../src/gameplay/PlasmaTraps';
import { GoliathSlamEffect } from '../src/effects/GoliathSlamEffect';
import { PyrokinesisScorch } from '../src/effects/PyrokinesisScorch';
import { PlasmaOrbScorch } from '../src/effects/PlasmaOrbScorch';

test('both nuclear orbs leave a stationary scorch only at explosion, preserved on recast', () => {
    const original = PlasmaOrbScorch.prototype.draw;
    const drawn: { x: number; y: number }[] = [];
    PlasmaOrbScorch.prototype.draw = function () { drawn.push({ x: this.x, y: this.y }); };
    try {
        for (const character of ['nuclear', 'plasma-nuclear'] as const) {
            const { ability, aim } = setup(character);
            const marks = () => {
                drawn.length = 0;
                ability.drawGroundEffects({} as CanvasRenderingContext2D);
                return [...drawn];
            };
            aim.x = 500;
            ability.update(3999);
            assert.deepEqual(marks(), []);
            ability.update(1);
            assert.deepEqual(marks(), [{ x: 500, y: 300 }]);
            aim.x = 700;
            ability.activate();
            assert.deepEqual(marks(), [{ x: 500, y: 300 }]);
            ability.update(4000);
            assert.deepEqual(marks(), [{ x: 500, y: 300 }, { x: 700, y: 300 }]);
            ability.update(8000);
            assert.deepEqual(marks(), [{ x: 700, y: 300 }]);
            ability.update(4000);
            assert.deepEqual(marks(), []);
            ability.activate(); ability.update(2000); ability.dispose(); ability.update(4000);
            assert.deepEqual(marks(), [], 'cancelled orb leaves no scorch');
        }
    } finally { PlasmaOrbScorch.prototype.draw = original; }
});

test('trap scorch marks outlive detonation and recast without keeping ability active', () => {
    const original = PyrokinesisScorch.prototype.draw;
    let drawn = 0;
    PyrokinesisScorch.prototype.draw = () => { drawn++; };
    try {
        const { ability, player, aim, enemies } = setup('hunter');
        for (const p of planPlasmaTraps(player, aim, player.angle)) {
            const enemy = new Enemy(p.x, p.y, EnemyType.BOSS);
            enemy.receiveDamage = () => {};
            enemies.push(enemy);
        }
        const count = () => {
            drawn = 0;
            ability.drawGroundEffects({} as CanvasRenderingContext2D);
            return drawn;
        };
        ability.update(350); ability.update(180); ability.update(400);
        assert.equal(ability.isActive, false);
        assert.equal(count(), 3);
        enemies.length = 0;
        ability.activate();
        ability.update(15400);
        assert.equal(count(), 0, 'expired marks and untriggered traps leave no burns');
        ability.dispose();
        assert.equal(count(), 0);
    } finally { PyrokinesisScorch.prototype.draw = original; }
});

test('pyrokinesis leaves stationary ground burns after fire and preserves them on recast', () => {
    const original = PyrokinesisScorch.prototype.draw;
    const drawn: { x: number; y: number }[] = [];
    PyrokinesisScorch.prototype.draw = function () { drawn.push({ x: this.x, y: this.y }); };
    try {
        const { ability, aim } = setup('telepath');
        const marks = () => {
            drawn.length = 0;
            ability.drawGroundEffects({} as CanvasRenderingContext2D);
            return [...drawn];
        };
        aim.x = 600;
        ability.update(5000);
        assert.equal(ability.isActive, false);
        assert.deepEqual(marks(), [{ x: 300, y: 300 }]);
        ability.activate();
        assert.deepEqual(marks(), [{ x: 300, y: 300 }, { x: 600, y: 300 }]);
        ability.update(12000);
        assert.deepEqual(marks(), [{ x: 600, y: 300 }]);
        ability.update(5000);
        assert.deepEqual(marks(), []);
        ability.activate();
        ability.dispose();
        assert.deepEqual(marks(), []);
    } finally { PyrokinesisScorch.prototype.draw = original; }
});

test('slam ground marks survive recovery and reactivation, expire and clear on disposal', () => {
    const original = GoliathSlamEffect.prototype.draw;
    let drawn = 0;
    GoliathSlamEffect.prototype.draw = () => { drawn++; };
    try {
        const { ability } = setup('goliath');
        const countMarks = () => {
            drawn = 0;
            ability.drawGroundEffects({} as CanvasRenderingContext2D);
            return drawn;
        };
        ability.update(280);
        ability.update(2000);
        assert.equal(ability.isActive, false);
        assert.equal(countMarks(), 1);
        ability.activate();
        assert.equal(countMarks(), 1, 'new windup preserves previous ground mark');
        ability.update(280);
        assert.equal(countMarks(), 2);
        ability.update(12000);
        assert.equal(countMarks(), 0);
        ability.activate(); ability.update(280);
        assert.equal(countMarks(), 1);
        ability.dispose();
        assert.equal(countMarks(), 0);
    } finally {
        GoliathSlamEffect.prototype.draw = original;
    }
});

function setup(character: CharacterId, enemies: Enemy[] = []) {
    const player = new Player(300, 300); player.character = character;
    const aim = { x: 300, y: 300 };
    const ability = new ExtendedCharacterAbilities(player, () => enemies, () => aim);
    ability.activate();
    return { player, enemies, aim, ability };
}

test('mutant claw strikes start only on nearby live targets and stop without targets', () => {
    const { ability, enemies } = setup('half-mutant');
    const motion = ability as unknown as { mutantStrikeTimes: number[] };
    ability.update(1000);
    assert.deepEqual(motion.mutantStrikeTimes, [-Infinity, -Infinity]);
    const far = new Enemy(900, 300, EnemyType.BOSS);
    const dead = new Enemy(300, 300); dead.receiveDamage(100);
    enemies.push(far, dead);
    ability.update(250);
    assert.deepEqual(motion.mutantStrikeTimes, [-Infinity, -Infinity]);
    far.x = 330;
    ability.update(250);
    assert.deepEqual(motion.mutantStrikeTimes, [1500, -Infinity]);
    ability.update(250);
    assert.deepEqual(motion.mutantStrikeTimes, [1500, 1750]);
    far.x = 900;
    ability.update(1000);
    assert.deepEqual(motion.mutantStrikeTimes, [1500, 1750], 'no new swings after target leaves');
    ability.activate();
    assert.deepEqual(motion.mutantStrikeTimes, [-Infinity, -Infinity]);
});

test('mutant lifesteal is bounded per pulse, ignores dead targets and restores form on expiry', () => {
    const enemies = Array.from({ length: 8 }, () => new Enemy(300, 300, EnemyType.BOSS));
    const { player, ability } = setup('half-mutant', enemies);
    player.currentHp = 50;
    assert.equal(player.abilityBlocksShooting, true);
    assert.equal(player.abilityMoveSpeed, 1.7);
    ability.update(0); ability.update(Number.NaN); ability.update(-100);
    assert.equal(player.currentHp, 50);
    ability.update(250); assert.equal(player.currentHp, 52);
    enemies.forEach(enemy => enemy.receiveDamage(100));
    ability.update(250); assert.equal(player.currentHp, 52);
    ability.update(6500);
    assert.equal(player.abilityForm, null);
    assert.equal(player.abilityMoveSpeed, 1);
    assert.equal(player.abilityBlocksShooting, false);
});

test('nuclear ball contacts once, freezes, tracks cursor and explodes exactly at four seconds', () => {
    const boss = new Enemy(450, 300, EnemyType.BOSS);
    let damage = 0;
    const receive = boss.receiveDamage.bind(boss);
    boss.receiveDamage = (amount, angle, push) => { damage += amount; receive(amount, angle, push); };
    const { aim, ability } = setup('nuclear', [boss]);
    aim.x = 450;
    ability.update(250);
    assert.equal(damage, 1);
    const x = boss.x; boss.setTarget(900, 300); boss.update(100);
    assert.equal(boss.x, x, 'contact freezes movement');
    ability.update(3749); assert.equal(damage, 1);
    ability.update(1); assert.equal(damage, 7);
    ability.update(10000); assert.equal(damage, 7);
});

test('silver hunter loses invisibility when all three traps trigger early; traps cannot repeat', () => {
    const { player, enemies, aim, ability } = setup('silver-hunter');
    assert.equal(player.abilityInvisible, true);
    for (const point of planPlasmaTraps(player, aim, player.angle)) enemies.push(new Enemy(point.x, point.y, EnemyType.BOSS));
    let hits = 0;
    enemies.forEach(enemy => { enemy.receiveDamage = () => { hits++; }; });
    ability.update(349);
    assert.equal(hits, 0, 'deployment cannot damage enemies');
    ability.update(1);
    ability.update(179);
    assert.equal(hits, 0, 'contact first winds up the discharge');
    ability.update(1);
    assert.ok(hits > 0);
    const completedHits = hits;
    ability.update(400);
    assert.equal(player.abilityInvisible, false);
    assert.equal(ability.isActive, false);
    ability.update(5000); assert.equal(hits, completedHits);
});

test('hunter traps persist beyond five seconds and expire without dealing proximity-free damage', () => {
    const { player, aim, enemies, ability } = setup('hunter');
    const point = planPlasmaTraps(player, aim, player.angle)[0];
    const boss = new Enemy(point.x + 90, point.y, EnemyType.BOSS);
    let damage = 0; boss.receiveDamage = amount => { damage += amount; };
    enemies.push(boss); // 90px from nearest trap: outside trigger but inside blast.
    ability.update(5000); assert.equal(damage, 0);
    assert.equal(ability.isActive, true);
    ability.update(10400); assert.equal(damage, 0);
    assert.equal(ability.isActive, false);
});

test('silver hunter invisibility expires at five seconds while unused traps remain armed', () => {
    const { player, ability } = setup('silver-hunter');
    ability.update(4999); assert.equal(player.abilityInvisible, true);
    ability.update(1); assert.equal(player.abilityInvisible, false);
    assert.equal(ability.isActive, true);
    ability.dispose(); assert.equal(ability.isActive, false);
});

test('radial abilities exclude distant enemies, slam waits for impact and gravity pushes once', () => {
    for (const character of ['goliath', 'cyborg'] as const) {
        const boss = new Enemy(400, 300, EnemyType.BOSS), outside = new Enemy(1000, 300);
        const { ability } = setup(character, [boss, outside]);
        if (character === 'goliath') {
            assert.equal(boss.x, 400, 'windup does not deal damage or push');
            ability.update(279);
            assert.equal(boss.x, 400);
            ability.update(1);
        }
        assert.equal(boss.x, character === 'cyborg' ? 490 : 420);
        assert.equal(outside.isDead, false);
        ability.update(1000); assert.equal(boss.x, character === 'cyborg' ? 490 : 420);
        boss.receiveDamage(character === 'cyborg' ? 15.9 : 14.9); assert.equal(boss.isDead, false);
        boss.receiveDamage(.2); assert.equal(boss.isDead, true);
    }
});

test('goliath recovers movement and shooting after impact and disposal cancels a pending slam', () => {
    const boss = new Enemy(400, 300, EnemyType.BOSS);
    const { player, ability } = setup('goliath', [boss]);
    assert.equal(player.abilityMoveSpeed, 0);
    assert.equal(player.abilityBlocksShooting, true);
    assert.equal(player.abilityPoseProgress, 0);
    ability.update(280);
    assert.equal(boss.x, 420);
    ability.update(420);
    assert.equal(player.abilityMoveSpeed, 1);
    assert.equal(player.abilityBlocksShooting, false);
    assert.equal(player.abilityPoseProgress, null);
    ability.activate();
    ability.update(100);
    ability.dispose();
    ability.update(1000);
    assert.equal(boss.x, 420, 'cancelled windup cannot deliver a late hit');
    assert.equal(player.abilityMoveSpeed, 1);
    assert.equal(player.abilityPoseProgress, null);
});

test('pyrokinesis keeps its activation target while the swarm follows aim', () => {
    for (const character of ['telepath', 'witcher'] as const) {
        const boss = new Enemy(300, 300, EnemyType.BOSS);
        let damage = 0; boss.receiveDamage = amount => { damage += amount; };
        const { ability, aim } = setup(character, [boss]);
        aim.x = 1000;
        ability.update(1000);
        assert.equal(damage, character === 'telepath' ? 1 : .5);
    }
});

test('storm pulses stop after duration and disposal clears all transformation flags', () => {
    const boss = new Enemy(300, 300, EnemyType.BOSS);
    let damage = 0; boss.receiveDamage = amount => { damage += amount; };
    const { player, ability } = setup('fanatic', [boss]);
    ability.update(500000);
    assert.equal(damage, 20);
    assert.equal(player.abilityForm, null);
    ability.activate(); assert.equal(player.abilityForm, 'storm');
    ability.dispose(); assert.equal(player.abilityForm, null);
    assert.equal(player.abilityMoveSpeed, 1);
    assert.equal(player.abilityInvisible, false);
});
