import type { Enemy } from '@/entities/enemy/Enemy';

import { SpatialGrid } from './SpatialGrid';

interface Body { x: number; y: number; radius: number; index: number }
/** Stable snapshot, one pass over neighboring cell pairs, bounded simultaneous correction. */
export class EnemySeparation {
    private grid = new SpatialGrid<Body>(40);
    private bodies: Body[] = [];
    private dx = new Float64Array(0);
    private dy = new Float64Array(0);
    checks = 0;
    private visit = (a: Body, b: Body): void => {
        this.checks++;
        const x = b.x - a.x, y = b.y - a.y, radius = a.radius + b.radius;
        const squared = x * x + y * y;
        if (squared >= radius * radius) return;
        const distance = Math.sqrt(squared), overlap = (radius - distance) * .5;
        const offsetX = (distance > 0 ? x / distance : 1) * overlap;
        const offsetY = (distance > 0 ? y / distance : 0) * overlap;
        this.dx[a.index] -= offsetX; this.dy[a.index] -= offsetY;
        this.dx[b.index] += offsetX; this.dy[b.index] += offsetY;
    };
    resolve(enemies: Enemy[]): void {
        if (this.dx.length < enemies.length) {
            this.dx = new Float64Array(enemies.length * 2);
            this.dy = new Float64Array(enemies.length * 2);
        }
        this.dx.fill(0, 0, enemies.length); this.dy.fill(0, 0, enemies.length); this.checks = 0;
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const body = this.bodies[i] ?? (this.bodies[i] = { x: 0, y: 0, radius: 0, index: i });
            body.x = enemy.x; body.y = enemy.y; body.radius = enemy.radius;
        }
        this.bodies.length = enemies.length;
        this.grid.rebuild(this.bodies);
        this.grid.forEachPair(this.visit);
        for (let i = 0; i < enemies.length; i++) {
            const length = Math.hypot(this.dx[i], this.dy[i]);
            const scale = length > enemies[i].radius ? enemies[i].radius / length : 1;
            enemies[i].x += this.dx[i] * scale; enemies[i].y += this.dy[i] * scale;
        }
    }
}
