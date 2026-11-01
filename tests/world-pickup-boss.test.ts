import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENA_BORDER, configureArena, getArenaSize, getVisibleArena, resetArena } from '../src/gameplay/Arena';
import { Pickup } from '../src/gameplay/Pickups';
import { BossEncounter } from '../src/gameplay/BossEncounter';
import { Enemy } from '../src/entities/enemy/Enemy';
import { EnemyType } from '../src/entities/enemy/EnemyType';

test('drops from outside the map land inside the concrete walls and remain collectible', () => {
    configureArena(1200, 800);
    try {
        const arena = getArenaSize();
        for (const [x, y] of [[0, 0], [arena.width, arena.height]]) {
            const pickup = new Pickup('health', x, y, x, y, 15);
            const player = { x: x ? arena.width - 52 : 52, y: y ? arena.height - 52 : 52, radius: 20, currentHp: 100 };
            for (let i = 0; i < 30; i++) {
                pickup.update(20, arena);
                assert.ok(pickup.x >= ARENA_BORDER + pickup.radius);
                assert.ok(pickup.y >= ARENA_BORDER + pickup.radius);
                assert.ok(pickup.x <= arena.width - ARENA_BORDER - pickup.radius);
                assert.ok(pickup.y <= arena.height - ARENA_BORDER - pickup.radius);
            }
            assert.ok(pickup.canCollect(player));
        }
    } finally { resetArena(); }
});

test('boss relocation stays on the current camera screen, including near the far map corner', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 } as Window & typeof globalThis;
    configureArena(1200, 800);
    try {
        const arena = getArenaSize();
        for (const player of [{ x: 1800, y: 1200, radius: 20 }, { x: 3500, y: 2300, radius: 20 }]) {
            const view = getVisibleArena(player);
            for (const random of [() => 0, () => 0.5, () => 0.999]) {
                const encounter = new BossEncounter(random) as unknown as {
                    relocate(enemy: Enemy, arena: { width: number; height: number }, player: { x: number; y: number; radius: number }): void;
                };
                const boss = new Enemy(player.x, player.y, EnemyType.WORM);
                encounter.relocate(boss, arena, player);
                assert.ok(boss.x - boss.radius >= view.x);
                assert.ok(boss.y - boss.radius >= view.y);
                assert.ok(boss.x + boss.radius <= view.x + view.width);
                assert.ok(boss.y + boss.radius <= view.y + view.height);
                assert.ok(boss.x >= ARENA_BORDER + boss.radius);
                assert.ok(boss.y >= ARENA_BORDER + boss.radius);
                assert.ok(boss.x <= arena.width - ARENA_BORDER - boss.radius);
                assert.ok(boss.y <= arena.height - ARENA_BORDER - boss.radius);
            }
        }
    } finally { resetArena(); globalThis.window = previousWindow; }
});
