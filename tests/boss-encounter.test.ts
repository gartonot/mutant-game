import test from 'node:test';
import assert from 'node:assert/strict';
import { BossEncounter } from '../src/gameplay/BossEncounter';
import { EnemyType } from '../src/entities/enemy/EnemyType';
import { Enemy } from '../src/entities/enemy/Enemy';

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
    const f = fixture(); f.tick(6000);
    assert.deepEqual(f.hits, [4, 4, 4]);
});
test('the announced gap stays safe for the whole roar even at midrange', () => {
    const f = fixture(); f.player.x = 640; f.tick(3550);
    f.player.x = f.enemy.x + Math.cos(.75) * 340;
    f.player.y = f.enemy.y + Math.sin(.75) * 340;
    f.tick(3000);
    assert.deepEqual(f.hits, []);
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
test('steroid can punish a stationary ranged player after its full warning', () => {
    const f = fixture(EnemyType.STEROID); f.player.x = 735;
    f.tick(4450); assert.deepEqual(f.hits, []);
    f.tick(100); assert.deepEqual(f.hits, [18]);
});
test('tentacle hook damages once and reels in a distant captured player', () => {
    const f = fixture(EnemyType.TENTACLE); f.player.x = 815; f.tick(5800);
    assert.deepEqual(f.hits, [16]); assert.ok(f.pulls.length > 0); assert.ok(f.player.x < 400);
});
test('tentacle windup can be sidestepped', () => {
    const f = fixture(EnemyType.TENTACLE); f.tick(3550); f.player.y = 550; f.tick(1500);
    assert.deepEqual(f.hits, []); assert.deepEqual(f.pulls, []);
});
test('below half health a missed hook leads a runner once; reversing during the second warning escapes', () => {
    for (const direction of [1, -1]) {
        const f = fixture(EnemyType.TENTACLE);
        f.enemy.currentHealth = f.enemy.maxHealth / 2;
        f.player.x = 580;
        f.tick(3500);
        for (let step = 0; step < 20; step++) { f.player.y += 8; f.tick(50); }
        assert.deepEqual(f.hits, []);
        for (let step = 0; step < 14; step++) { f.player.y += direction * 8; f.tick(50); }
        assert.deepEqual(f.hits, direction === 1 ? [16] : []);
        if (direction === -1) { f.tick(900); assert.deepEqual(f.hits, []); }
    }
});
test('a captured player can escape the marked lash after the last movement lock expires', () => {
    const f = fixture(EnemyType.TENTACLE);
    f.tick(4700); // The nearby player has been reeled in, and the sweep is charging.
    assert.deepEqual(f.hits, [16]);
    const lastRoot = f.pulls.at(-1)!;
    assert.equal(lastRoot, 100);
    f.tick(lastRoot);
    for (let frame = 0; frame < 45; frame++) {
        f.player.y += 5;
        f.tick(1000 / 60);
    }
    assert.deepEqual(f.hits, [16]);

    const stationary = fixture(EnemyType.TENTACLE);
    stationary.tick(6000);
    assert.deepEqual(stationary.hits, [16, 16]);
});

test('each successive boss punishes a stationary target more heavily over the same twelve seconds', () => {
    const damage = [EnemyType.BOSS, EnemyType.STEROID, EnemyType.TENTACLE, EnemyType.WORM].map(type => {
        const f = fixture(type);
        f.player.x = 580; // 280 px from the initial spawn. The worm picks its own hole.
        f.tick(12000);
        return f.hits.reduce((sum, hit) => sum + hit, 0);
    });
    for (let i = 1; i < damage.length; i++) {
        assert.ok(damage[i] > damage[i - 1], `special attack damage in encounter order: ${damage.join(', ')}`);
    }
});
test('worm leaves a feeding pit, recovers, then relocates without a death blast', () => {
    const f = fixture(EnemyType.WORM); f.tick(2000);
    f.player.x = f.enemy.x + 100; f.player.y = f.enemy.y; f.tick(7000);
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
    invisiblePlayer.abilityInvisible = false; f.tick(2000); assert.deepEqual(f.hits, [16]);
});
test('fear interrupts boss windup and releases movement for fleeing', () => {
    const f = fixture(EnemyType.STEROID); f.tick(3550);
    (f.enemy as typeof f.enemy & { isFeared?: boolean }).isFeared = true;
    f.tick(1200); assert.deepEqual(f.hits, []); assert.equal(f.enemy.movementLocked, false);
});
test('roar rings cannot damage outside their maximum radius', () => {
    const f = fixture(); f.tick(3550); f.player.x = 760; f.tick(3000);
    assert.deepEqual(f.hits, []);
});

test('fear interrupts the worm without tearing it out of its pit', () => {
    const f = fixture(EnemyType.WORM); f.tick(2100);
    assert.equal(f.enemy.movementLocked, true);
    (f.enemy as typeof f.enemy & { isFeared?: boolean }).isFeared = true;
    f.tick(100); assert.equal(f.enemy.movementLocked, true);
    const spot = { x: f.enemy.x, y: f.enemy.y };
    f.tick(4000); assert.deepEqual([f.enemy.x, f.enemy.y], [spot.x, spot.y]); assert.deepEqual(f.hits, []);
});

test('burrowed worm is untargetable and becomes targetable on its next emergence', () => {
    const f = fixture(EnemyType.WORM); f.tick(2000);
    f.player.x = f.enemy.x + 100; f.player.y = f.enemy.y;
    f.tick(5000);
    const enemy = f.enemy as typeof f.enemy & { targetable: boolean };
    assert.equal(enemy.targetable, false);
    f.tick(1000); assert.equal(enemy.targetable, true);
    f.boss.reset(); assert.equal(enemy.targetable, true);
});

test('worm changes holes when kited and its encounter announcement does not restart', () => {
    const f = fixture(EnemyType.WORM); f.tick(2100);
    f.player.x = 900; f.player.y = 750;
    f.tick(5000);
    assert.ok(f.marks.filter(mark => mark === 'hole').length >= 2);
    assert.equal(f.boss.hudState?.ageMs, 7100);
    assert.ok(Math.hypot(f.enemy.x - f.player.x, f.enemy.y - f.player.y) < 350);
});

test('walking bosses close on a running player using normal waypoints and slow for the attack', () => {
    for (const type of [EnemyType.BOSS, EnemyType.STEROID, EnemyType.TENTACLE]) {
        const enemy = new Enemy(150, 400, type), baseSpeed = enemy.speed;
        const player = { x: 1000, y: 400, radius: 16 };
        const boss = new BossEncounter(); boss.registerBoss(enemy);
        const tick = (ms: number) => boss.update(ms, player, { width: 5000, height: 2000 }, { damagePlayer() {}, pullPlayer() {} });
        tick(2000);
        enemy.setTarget(player.x, player.y);
        enemy.setMovementWaypoint({ x: enemy.x, y: 500 });
        tick(16); enemy.update(16);
        assert.equal(enemy.x, 150);
        assert.ok(enemy.y > 405, 'pursuit respects the waypoint');
        for (let i = 0; i < 350 && !enemy.movementLocked; i++) {
            player.x += 5;
            enemy.setTarget(player.x, player.y);
            tick(16); enemy.update(16);
        }
        assert.equal(enemy.movementLocked, true, 'caught up far enough to telegraph a special attack');
        assert.equal(enemy.speed, baseSpeed);
    }
});


test('the worm fixes each warning before impact and leaves an acid pool only at the marked position', () => {
    const f = fixture(EnemyType.WORM); f.tick(2000);
    f.player.x = f.enemy.x + 220; f.player.y = f.enemy.y;
    f.tick(1500); // Fissure locks onto the current horizontal line.
    f.player.y += 120; f.tick(950);
    assert.deepEqual(f.hits, []);
    f.tick(50); // Eruption fixes the location where the player dodged.
    f.player.y += 130; f.tick(900);
    assert.deepEqual(f.hits, []);
    f.player.y -= 130;
    f.tick(599); assert.deepEqual(f.hits, []);
    f.tick(1); assert.deepEqual(f.hits, [10]);
    f.player.y += 130; f.tick(600); assert.deepEqual(f.hits, [10]);
});

test('low-health worm targets the escape route twice, permitting a fresh dodge after each lock', () => {
    const f = fixture(EnemyType.WORM);
    f.enemy.currentHealth = f.enemy.maxHealth / 2;
    f.tick(2000);
    f.player.x = f.enemy.x + 200; f.player.y = f.enemy.y;
    f.tick(1500);
    // Move sideways at 300 px/s. Continuing along this route lands inside the predicted eruption.
    for (let i = 0; i < 20; i++) { f.player.y += 15; f.tick(50); }
    for (let i = 0; i < 18; i++) { f.player.y += 15; f.tick(50); }
    assert.deepEqual(f.hits, [24], 'straight movement through the first marked spot takes damage');
    for (let i = 0; i < 16; i++) { f.player.x -= 15; f.tick(50); }
    assert.deepEqual(f.hits, [24], 'changing direction evades the second independently locked spot and escapes the acid');
});

test('the worm absorbs repeated gun and ability impulses while taking damage', () => {
    const worm = new Enemy(300, 300, EnemyType.WORM);
    for (let i = 0; i < 12; i++) worm.receiveDamage(2, Math.PI / 4, i % 2 ? 600 : 12);
    assert.deepEqual([worm.x, worm.y], [300, 300]);
    assert.equal(worm.currentHealth, worm.maxHealth - 24);
});
