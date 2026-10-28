import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlasmaTraps, planPlasmaTraps } from '../src/gameplay/PlasmaTraps';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';

function setup() {
    const player = new Player(300, 300); player.character = 'hunter';
    const aim = { x: 900, y: 300 };
    const enemies: Enemy[] = [];
    const traps = new PlasmaTraps(player, () => enemies, aim);
    const positions = planPlasmaTraps(player, aim);
    let damage = 0;
    const addEnemy = (x: number, y: number) => {
        const enemy = new Enemy(x, y);
        enemy.receiveDamage = amount => { damage += amount; };
        enemies.push(enemy); return enemy;
    };
    return { traps, positions, enemies, addEnemy, damage: () => damage };
}

test('plasma traps deploy a distinct three-pad fan towards the cursor, including at arena corners', () => {
    const points = planPlasmaTraps({ x: 300, y: 300 }, { x: 900, y: 300 });
    assert.equal(points.length, 3);
    assert.deepEqual(points[0], { x: 460, y: 300 });
    assert.ok(points.every(p => p.x > 430));
    assert.ok(points[1].y < 300 && points[2].y > 300);
    for (const origin of [{ x: 0, y: 0 }, { x: 640, y: 480 }, { x: 0, y: 480 }, { x: 640, y: 0 }]) {
        const pads = planPlasmaTraps(origin, { x: origin.x * 2 - 320, y: origin.y * 2 - 240 }, 0, { width: 640, height: 480 });
        pads.forEach((p, i) => {
            assert.ok(p.x >= 35 && p.x <= 605 && p.y >= 35 && p.y <= 445);
            for (const other of pads.slice(i + 1)) assert.ok(Math.hypot(p.x - other.x, p.y - other.y) >= 58);
        });
    }
});

test('plasma traps arm, telegraph, then hit once; zero/invalid updates do not advance simulation', () => {
    const s = setup(); s.addEnemy(s.positions[0].x, s.positions[0].y);
    for (const delta of [0, -20, NaN, Infinity]) s.traps.update(delta);
    s.traps.update(349); assert.equal(s.damage(), 0);
    s.traps.update(180); assert.equal(s.damage(), 0);
    s.traps.update(1); assert.equal(s.damage(), 5);
    s.traps.update(3000); assert.equal(s.damage(), 5);
    assert.equal(s.traps.isActive, true, 'two untriggered traps remain');
    s.traps.dispose(); assert.equal(s.traps.isActive, false);
});

test('untriggered traps expire quietly and cannot trigger while fading', () => {
    const s = setup();
    s.traps.update(15000);
    s.positions.forEach(p => s.addEnemy(p.x, p.y));
    s.traps.update(399); assert.equal(s.damage(), 0);
    s.traps.update(1); assert.equal(s.traps.isActive, false);
    assert.equal(s.damage(), 0);
});

test('trap damage is stable across coarse and fine frame updates for stationary targets', () => {
    for (const step of [1, 10, 53, 530]) {
        const s = setup(); s.addEnemy(s.positions[0].x, s.positions[0].y);
        let elapsed = 0;
        while (elapsed < 530) { const delta = Math.min(step, 530 - elapsed); s.traps.update(delta); elapsed += delta; }
        assert.equal(s.damage(), 5);
        s.traps.update(20000); assert.equal(s.damage(), 5); assert.equal(s.traps.isActive, false);
    }
});

test('dead enemies cannot trigger a trap and owner death clears active traps', () => {
    const player = new Player(300, 300), enemy = new Enemy(460, 300);
    enemy.receiveDamage(1000);
    const traps = new PlasmaTraps(player, () => [enemy], { x: 900, y: 300 });
    traps.update(1000); assert.equal(traps.isActive, true);
    player.currentHp = 0; traps.update(1); assert.equal(traps.isActive, false);
});
