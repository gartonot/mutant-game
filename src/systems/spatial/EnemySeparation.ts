import type { Enemy } from '@/entities/enemy/Enemy';

import { SpatialGrid } from './SpatialGrid';

interface Body { x: number; y: number; radius: number; index: number; fixed: boolean; startX: number; startY: number }
/** Relax contacts from snapshots, averaging pressure instead of summing crowd impulses. */
export class EnemySeparation {
    private grid = new SpatialGrid<Body>(40);
    private bodies: Body[] = [];
    private dx = new Float64Array(0);
    private dy = new Float64Array(0);
    private contacts = new Uint32Array(0);
    checks = 0;
    private visit = (a: Body, b: Body): void => {
        this.checks++;
        const x = b.x - a.x, y = b.y - a.y, radius = a.radius + b.radius;
        const squared = x * x + y * y;
        if (squared >= radius * radius) return;
        if (a.fixed && b.fixed) return;
        const distance = Math.sqrt(squared), overlap = radius - distance;
        const offsetX = (distance > 0 ? x / distance : 1) * overlap;
        const offsetY = (distance > 0 ? y / distance : 0) * overlap;
        const share = a.fixed || b.fixed ? 1 : .5;
        if (!a.fixed) {
            this.dx[a.index] -= offsetX * share; this.dy[a.index] -= offsetY * share;
            this.contacts[a.index]++;
        }
        if (!b.fixed) {
            this.dx[b.index] += offsetX * share; this.dy[b.index] += offsetY * share;
            this.contacts[b.index]++;
        }
    };
    resolve(enemies: Enemy[]): void {
        if (this.dx.length < enemies.length) {
            this.dx = new Float64Array(enemies.length * 2);
            this.dy = new Float64Array(enemies.length * 2);
            this.contacts = new Uint32Array(enemies.length * 2);
        }
        this.checks = 0;
        // Several small relaxation steps prevent deep crowd compression without the
        // overshoot caused by adding a full correction for every touching neighbor.
        for (let iteration = 0; iteration < 3; iteration++) {
            this.dx.fill(0, 0, enemies.length); this.dy.fill(0, 0, enemies.length);
            this.contacts.fill(0, 0, enemies.length);
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                const body = this.bodies[i] ?? (this.bodies[i] = { x: 0, y: 0, radius: 0, index: i, fixed: false, startX: 0, startY: 0 });
                body.x = enemy.x; body.y = enemy.y; body.radius = enemy.radius;
                body.fixed = enemy.isFeared;
                if (iteration === 0) { body.startX = enemy.x; body.startY = enemy.y; }
            }
            this.bodies.length = enemies.length;
            this.grid.rebuild(this.bodies);
            this.grid.forEachPair(this.visit);
            for (let i = 0; i < enemies.length; i++) {
                if (!this.contacts[i]) continue;
                const length = Math.hypot(this.dx[i], this.dy[i]) / this.contacts[i];
                const limit = enemies[i].radius;
                const scale = (length > limit ? limit / length : 1) / this.contacts[i];
                enemies[i].x += this.dx[i] * scale; enemies[i].y += this.dy[i] * scale;
            }
        }
        // Preserve the per-tick displacement bound even for coincident spawns.
        for (let i = 0; i < enemies.length; i++) {
            const body = this.bodies[i], enemy = enemies[i];
            const x = enemy.x - body.startX, y = enemy.y - body.startY;
            const distance = Math.hypot(x, y);
            if (distance > enemy.radius) {
                enemy.x = body.startX + x / distance * enemy.radius;
                enemy.y = body.startY + y / distance * enemy.radius;
            }
        }
    }
}
