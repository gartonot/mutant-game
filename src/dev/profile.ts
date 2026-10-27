import { FixedStep } from '@/core/FixedStep';
import { BulletTrail } from '@/effects/BulletTrail';
import { Bullet } from '@/entities/bullet/Bullet';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { EnemySeparation } from '@/systems/spatial/EnemySeparation';

import { compareCollisions } from '../../scripts/bench/comparison';
import { BulletTrail as LegacyTrail } from '../../scripts/bench/LegacyBulletTrail';
import { scenario, summarize } from '../../scripts/bench/scenario';

const ctx = document.querySelector('canvas')!.getContext('2d')!;
const result = document.querySelector('#result')!;
let running = false;
const show = (value: unknown) => { result.textContent = JSON.stringify(value, null, 2); };
document.querySelector('#collisions')!.addEventListener('click', () => {
    if (!running) show({ userAgent: navigator.userAgent, collisions: compareCollisions(15) });
});
document.querySelector('#trails')!.addEventListener('click', () => {
    if (running) return;
    const before: number[] = [], after: number[] = [];
    for (const [Trail, times] of [[LegacyTrail, before], [BulletTrail, after]] as const) {
        const trails = Array.from({ length: 300 }, (_, i) => new Trail(i % 30 * 60, Math.floor(i / 30) * 90));
        trails.forEach((trail, i) => { for (let t = 1; t <= 25; t++) trail.update(i % 30 * 60 + t * 10, Math.floor(i / 30) * 90); });
        for (let i = 0; i < 12; i++) {
            ctx.clearRect(0, 0, 1920, 1080);
            const start = performance.now();
            trails.forEach(trail => trail.draw(ctx));
            // Force canvas submission for both versions; still not a GPU frame-time measurement.
            ctx.getImageData(0, 0, 1, 1);
            if (i >= 3) times.push(performance.now() - start);
        }
    }
    show({ trails: 300, before: summarize(before), after: summarize(after) });
});
document.querySelector('#stress')!.addEventListener('click', () => {
    if (running) return;
    running = true;
    const scene = scenario(3000, 1000);
    const collision = new CollisionSystem(), separation = new EnemySeparation(), clock = new FixedStep();
    const updates: number[] = [], renders: number[] = [], intervals: number[] = [];
    let frames = 0, previous = 0, warmupDroppedMs = 0;
    const frame = (now: number) => {
        const start = performance.now();
        clock.advance(now, () => {
            for (const enemy of scene.enemies) { enemy.setTarget(960, 540); enemy.update(); }
            for (let i = 0; i < scene.bullets.length; i++) {
                let bullet = scene.bullets[i];
                if (bullet.isDead || bullet.expired) {
                    bullet = scene.bullets[i] = new Bullet((i * 107) % 1920, (i * 71) % 1080, i, 0, 10, 0);
                }
                bullet.damage = 0; bullet.pushBackForce = 0;
                bullet.update();
            }
            collision.checkBulletEnemyCollisions(scene.controller, scene.enemies);
            separation.resolve(scene.enemies);
        });
        const updated = performance.now();
        ctx.clearRect(0, 0, 1920, 1080);
        for (const enemy of scene.enemies) enemy.draw(ctx);
        // Intentionally draw all 1000, even shots resolved this tick: sustained render load.
        for (const bullet of scene.bullets) bullet.draw(ctx);
        if (frames === 30) warmupDroppedMs = clock.droppedMs;
        if (frames >= 30) { updates.push(updated - start); renders.push(performance.now() - updated); intervals.push(now - previous); }
        previous = now;
        frames++;
        if (frames < 600) requestAnimationFrame(frame);
        else { running = false; show({ enemies: 3000, bullets: 1000, samples: updates.length, update: summarize(updates),
            render: summarize(renders), frameInterval: summarize(intervals), droppedSimulationMs: clock.droppedMs - warmupDroppedMs, warmupDroppedMs }); }
    };
    requestAnimationFrame(frame);
});
