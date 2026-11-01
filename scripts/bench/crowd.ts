import { configureArena, resetArena } from '../../src/gameplay/Arena';
import { Enemy } from '../../src/entities/enemy/Enemy';
import { EnemyType } from '../../src/entities/enemy/EnemyType';
import { Player } from '../../src/entities/player/Player';
import { GameWorld } from '../../src/systems/GameWorld';
import type { PlayerController } from '../../src/systems/Player/PlayerController';

/** CPU-only world benchmark. All enemies keep simulating; no raster/GPU measurements. */
function run(count: number, moving: boolean) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 1280, innerHeight: 720 } });
    configureArena(1280, 720);
    let seed = 9417;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const player = new Player(1920, 1080);
    player.currentHp = 1e9;
    let ticks = 0;
    const controller = {
        getPlayer: () => player,
        update() { if (moving) { player.x = 1920 + Math.sin(ticks / 55) * 220; player.y = 1080 + Math.cos(ticks / 65) * 170; } ticks++; },
        getBullets: () => [], cleanupBullets() {}, getAimPosition: () => ({ x: player.x, y: player.y }),
        registerKill() {}, acquiredAmmoCategories: [], isMoving: moving,
    } as unknown as PlayerController;
    const world = new GameWorld(controller, random, [], []);
    const state = world as unknown as { enemies: Enemy[]; wavesStarted: number };
    state.wavesStarted = 999;
    state.enemies = Array.from({ length: count }, (_, index) => new Enemy(
        100 + random() * 3640, 100 + random() * 1960,
        index % 12 === 0 ? EnemyType.BUG : index % 17 === 0 ? EnemyType.RUNNER : EnemyType.GRUNT));
    const samples: number[] = [];
    try {
        for (let tick = 0; tick < 210; tick++) {
            const start = performance.now();
            world.update(1000 / 60);
            if (tick >= 30) samples.push(performance.now() - start);
        }
        const sorted = [...samples].sort((a, b) => a - b);
        return { enemies: count, moving, meanMs: +(samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(3),
            medianMs: +sorted[Math.floor(sorted.length * .5)].toFixed(3), p95Ms: +sorted[Math.floor(sorted.length * .95)].toFixed(3) };
    } finally {
        world.dispose(); resetArena();
        if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
    }
}

console.log(JSON.stringify({ runtime: process.version, cpuOnly: true,
    scenarios: [run(300, false), run(600, true), run(1000, true)] }, null, 2));
