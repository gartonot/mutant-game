import { CollisionSystem as LegacyCollisionSystem } from './LegacyCollisionSystem';
import { CollisionSystem } from '../../src/systems/CollisionSystem';
import { EnemySeparation } from '../../src/systems/spatial/EnemySeparation';
import { scenario, legacySeparation, summarize } from './scenario';

export function compareCollisions(samples = 25) {
    const legacy = new LegacyCollisionSystem();
    const current = new CollisionSystem();
    const separation = new EnemySeparation();
    const results = [];
    for (const [enemies, bullets, clustered] of [[1000, 300, false], [3000, 1000, false], [3000, 1000, true]] as const) {
        const before: number[] = [], after: number[] = [];
        let checks = 0;
        for (let i = 0; i < samples + 10; i++) {
            // Alternate order to reduce warm-up / thermal bias; allocation is outside timing.
            for (const optimized of i % 2 ? [true, false] : [false, true]) {
                const scene = scenario(enemies, bullets, clustered);
                const start = performance.now();
                if (optimized) {
                    current.checkBulletEnemyCollisions(scene.controller, scene.enemies);
                    separation.resolve(scene.enemies);
                    checks = current.checks + separation.checks;
                } else {
                    legacy.checkBulletEnemyCollisions(scene.controller, scene.enemies);
                    legacySeparation(scene.enemies);
                }
                if (i >= 10) (optimized ? after : before).push(performance.now() - start);
            }
        }
        results.push({ enemies, bullets, clustered, before: summarize(before), after: summarize(after),
            potentialBruteChecks: enemies * bullets + enemies * (enemies - 1) / 2, optimizedChecks: checks });
    }
    return results;
}

if (typeof window === 'undefined') console.log(JSON.stringify({ runtime: process.version, results: compareCollisions() }, null, 2));
