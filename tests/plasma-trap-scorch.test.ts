import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlasmaTraps, planPlasmaTraps } from '../src/gameplay/PlasmaTraps';
import { Player } from '../src/entities/player/Player';
import { Enemy } from '../src/entities/enemy/Enemy';

function setup() {
    const player = new Player(300, 300);
    player.character = 'hunter';
    const aim = { x: 900, y: 300 };
    const enemies: Enemy[] = [];
    const marks: { x: number; y: number }[] = [];
    const positions = planPlasmaTraps(player, aim, player.angle);
    const traps = new PlasmaTraps(player, () => enemies, aim, (x, y) => marks.push({ x, y }));
    return { traps, enemies, marks, positions };
}

test('plasma trap creates a scorch at its impact position only once after the detonation windup', () => {
    const s = setup();
    const impact = s.positions[0];
    s.enemies.push(new Enemy(impact.x, impact.y));
    s.traps.update(350);
    assert.deepEqual(s.marks, [], 'arming does not scorch the ground');
    s.traps.update(179);
    assert.deepEqual(s.marks, [], 'charging does not scorch the ground');
    s.traps.update(1);
    assert.deepEqual(s.marks, [impact]);
    s.traps.update(400);
    s.traps.update(20000);
    assert.deepEqual(s.marks, [impact], 'the fading explosion cannot create duplicate marks');
});

test('untriggered plasma traps expire without leaving blast scorches', () => {
    const s = setup();
    s.traps.update(15000);
    s.traps.update(400);
    assert.equal(s.traps.isActive, false);
    assert.deepEqual(s.marks, []);
});

test('disposing a charging plasma trap does not leave a scorch', () => {
    const s = setup();
    const impact = s.positions[0];
    s.enemies.push(new Enemy(impact.x, impact.y));
    s.traps.update(350);
    s.traps.dispose();
    s.traps.update(20000);
    assert.deepEqual(s.marks, []);
});
