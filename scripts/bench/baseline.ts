import { CollisionSystem } from './LegacyCollisionSystem';
import { scenario, legacySeparation, summarize } from './scenario';

const collision = new CollisionSystem();
const results = [];
for (const [enemies, bullets, clustered] of [[1000, 300, false], [3000, 1000, false], [3000, 1000, true]] as const) {
    const samples = [];
    for (let i = 0; i < 35; i++) {
        const scene = scenario(enemies, bullets, clustered);
        const start = performance.now();
        collision.checkBulletEnemyCollisions(scene.controller, scene.enemies);
        legacySeparation(scene.enemies);
        if (i >= 10) samples.push(performance.now() - start);
    }
    results.push({ enemies, bullets, clustered, ...summarize(samples) });
}
console.log(JSON.stringify({ runtime: process.version, baseline: results }, null, 2));
