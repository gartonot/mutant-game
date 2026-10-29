import test from 'node:test';
import assert from 'node:assert/strict';
import { BossEncounter } from '../src/gameplay/BossEncounter';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import type { Enemy } from '../src/entities/enemy/Enemy';

function fixture(type: EnemyType = EnemyType.BOSS) {
    const enemy = { type, x: 300, y: 300, radius: 48, currentHealth: 160, maxHealth: 160, isDead: false,
        movementLocked: false, contactDisabled: false, invulnerable: false, renderScale: 1,
        setMaxHealth(value: number) { this.maxHealth = value; this.currentHealth = value; }, faceTarget() {}, draw() {} };
    const player = { x: 440, y: 300, radius: 16 };
    const hits: number[] = [], pulls: number[] = [], marks: string[] = [];
    const callbacks = { damagePlayer: (n: number) => hits.push(n),
        pullPlayer: (x: number, y: number, ms: number) => { player.x = x; player.y = y; pulls.push(ms); },
        stampGround: (_x: number, _y: number, _radius: number, kind: string) => marks.push(kind) };
    const boss = new BossEncounter(() => .75); boss.registerBoss(enemy as unknown as Enemy);
    const tick = (ms: number) => boss.update(ms, player, { width: 1000, height: 800 }, callbacks);
    return { boss, enemy, player, hits, pulls, marks, tick };
}
test('boss entry takes two seconds and blocks attacks and damage', () => {
    const f = fixture(); f.tick(1999);
    assert.equal(f.enemy.invulnerable, true); assert.equal(f.enemy.contactDisabled, true); assert.deepEqual(f.hits, []);
    f.tick(1); assert.equal(f.enemy.invulnerable, false); assert.equal(f.enemy.contactDisabled, false);
});
test('Mozgovorot roar produces three separate damaging waves', () => {
    const f = fixture(); f.tick(5000);
    assert.deepEqual(f.hits, [4, 4, 4]);
});
test('dead boss occupies slot until swelling finishes and blasts only once', () => {
    const f = fixture(); f.tick(2000); f.enemy.isDead = true; f.player.x = 350;
    f.tick(1200); assert.equal(f.boss.occupied, true); assert.ok(f.enemy.renderScale > 1);
    f.tick(100); assert.equal(f.boss.occupied, false); assert.deepEqual(f.hits, [12]);
    f.tick(500); assert.deepEqual(f.hits.filter(n => n > 0), [12]);
});
test('steroid slam aims at a warned location which player can evade', () => {
    const f = fixture(EnemyType.STEROID); f.tick(3550); f.player.y = 600; f.tick(1000);
    assert.deepEqual(f.hits, []); assert.ok(f.marks.includes('crater'));
});
test('tentacle hook deals four once and pulls captured player', () => {
    const f = fixture(EnemyType.TENTACLE); f.tick(5000);
    assert.deepEqual(f.hits, [4]); assert.ok(f.pulls.length > 0); assert.ok(f.player.x < 440);
});
test('tentacle windup can be sidestepped', () => {
    const f = fixture(EnemyType.TENTACLE); f.tick(3550); f.player.y = 550; f.tick(1500);
    assert.deepEqual(f.hits, []); assert.deepEqual(f.pulls, []);
});
test('worm leaves holes, roars near player then relocates and has no death blast', () => {
    const f = fixture(EnemyType.WORM); f.tick(2000);
    f.player.x = f.enemy.x + 100; f.player.y = f.enemy.y; f.tick(6000);
    assert.ok(f.marks.filter(x => x === 'hole').length >= 2);
    f.enemy.isDead = true; f.hits.length = 0; f.tick(1500);
    assert.equal(f.boss.occupied, false); assert.ok(!f.hits.includes(12)); assert.ok(!f.marks.includes('blast'));
});
test('reset removes all occupancy and effects; invalid delta cannot advance fight', () => {
    const f = fixture(); f.tick(Number.NaN); f.tick(-10); assert.equal(f.boss.hudState?.ageMs, 0);
    f.boss.reset(); assert.equal(f.boss.occupied, false); assert.equal(f.boss.hudState, null);
});

test('invisibility prevents a new targeted attack and cancels an aimed hook', () => {
    const f = fixture(EnemyType.TENTACLE);
    const invisiblePlayer = f.player as typeof f.player & { abilityInvisible?: boolean };
    f.tick(3550); invisiblePlayer.abilityInvisible = true; f.tick(3000);
    assert.deepEqual(f.hits, []); assert.deepEqual(f.pulls, []);
    invisiblePlayer.abilityInvisible = false; f.tick(2000); assert.deepEqual(f.hits, [4]);
});
test('fear interrupts boss windup and releases movement for fleeing', () => {
    const f = fixture(EnemyType.STEROID); f.tick(3550);
    (f.enemy as typeof f.enemy & { isFeared?: boolean }).isFeared = true;
    f.tick(1200); assert.deepEqual(f.hits, []); assert.equal(f.enemy.movementLocked, false);
});
test('roar rings cannot damage outside their maximum radius', () => {
    const f = fixture(); f.tick(3550); f.player.x = 600; f.tick(2000);
    assert.deepEqual(f.hits, []);
});

test('fear releases a stationary worm head so Enemy can flee', () => {
    const f = fixture(EnemyType.WORM); f.tick(2100);
    assert.equal(f.enemy.movementLocked, true);
    (f.enemy as typeof f.enemy & { isFeared?: boolean }).isFeared = true;
    f.tick(100); assert.equal(f.enemy.movementLocked, false);
});

test('burrowed worm is untargetable and becomes targetable on its next emergence', () => {
    const f = fixture(EnemyType.WORM); f.tick(2000);
    f.player.x = f.enemy.x + 100; f.player.y = f.enemy.y;
    f.tick(3000);
    const enemy = f.enemy as typeof f.enemy & { targetable: boolean };
    assert.equal(enemy.targetable, false);
    f.tick(1000); assert.equal(enemy.targetable, true);
    f.boss.reset(); assert.equal(enemy.targetable, true);
});
