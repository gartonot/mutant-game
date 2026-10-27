import { Enemy } from '../../src/entities/enemy/Enemy';
import { Bullet } from '../../src/entities/bullet/Bullet';
import type { PlayerController } from '../../src/systems/Player/PlayerController';

export function scenario(count: number, shots: number, clustered = false) {
    let seed = 42;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const width = clustered ? 500 : 1920;
    const height = clustered ? 500 : 1080;
    const enemies = Array.from({ length: count }, () => new Enemy(random() * width, random() * height));
    const bullets = Array.from({ length: shots }, () => new Bullet(random() * width, random() * height, random() * Math.PI * 2, .1));
    const controller = { getBullets: () => bullets, getPlayer: () => ({ x: 960, y: 540 }), registerHit() {} } as unknown as PlayerController;
    return { enemies, bullets, controller };
}

export function legacySeparation(enemies: Enemy[]) {
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const a = enemies[i], b = enemies[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const squared = dx * dx + dy * dy, radius = a.radius + b.radius;
            if (squared < radius * radius) {
                const distance = Math.sqrt(squared) || 1;
                const overlap = (radius - distance) / 2;
                const x = dx / distance * overlap, y = dy / distance * overlap;
                a.x -= x; a.y -= y; b.x += x; b.y += y;
            }
        }
    }
}
export function summarize(samples: number[]) {
    const sorted = [...samples].sort((a, b) => a - b);
    return { medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(3), p95Ms: +sorted[Math.floor(sorted.length * .95)].toFixed(3) };
}
