import { Enemy } from '@/entities/enemy/Enemy';
import { EnemyType } from '@/entities/enemy/EnemyType';
import { ARENA_BORDER, getArenaSize, isArenaConfigured } from '@/gameplay/Arena';

import { BOSS_SEQUENCE, BOSS_WAVE_INTERVAL, SURVIVAL_WAVE_COUNT, WaveConfigs } from './WaveConfig';
import type { IWaveRule } from './WaveConfig';

interface SpawnViewport { x?: number; y?: number; width: number; height: number }

export interface WaveSystemOptions {
    rules?: readonly IWaveRule[];
    random?: () => number;
    viewport?: () => SpawnViewport;
}

export class WaveSystem {
    private currentWaveIndex = 0;
    private nextBossIndex = 0;
    private lastBoss?: Enemy;
    private ingressSide = 2;
    private readonly rules: readonly IWaveRule[];
    private readonly random: () => number;
    private readonly viewport: () => SpawnViewport;

    constructor(options: WaveSystemOptions = {}) {
        this.rules = options.rules ?? WaveConfigs;
        this.random = options.random ?? Math.random;
        this.viewport = options.viewport ?? (() => getArenaSize());
        if (!this.rules.length || this.rules.some(rule =>
            !rule.types.length || !Number.isInteger(rule.count) || rule.count < 0 ||
            (rule.composition !== undefined && (rule.composition.length !== rule.count ||
                rule.composition.some(type => !rule.types.includes(type)))))) {
            throw new Error('Wave rules require at least one enemy type and a non-negative integer count');
        }
    }

    public spawnWave(bossOccupied = false): Enemy[] {
        if (this.rules === WaveConfigs && this.currentWaveIndex >= SURVIVAL_WAVE_COUNT) return [];
        const config = this.rules[this.currentWaveIndex] ?? this.rules[this.rules.length - 1];
        const enemies: Enemy[] = [];
        const survival = this.rules === WaveConfigs;
        // Hold the dominant entry front across several waves, like a sustained
        // crowd rather than teleporting its source to a new edge every group.
        const sideRoll = survival ? this.random() : 0;
        if (this.currentWaveIndex % 3 === 0) this.ingressSide = sideRoll < .4 ? 2 : sideRoll < .8 ? 3 : sideRoll < .9 ? 0 : 1;
        const side = this.ingressSide;
        const anchors = survival ? [.15 + this.random() * .7, .15 + this.random() * .7] : [];
        const bugCount = survival ? config.composition!.filter(type => type === EnemyType.BUG).length : 0;
        let remainingBugs = bugCount;
        let bugGroup = 0;
        let bugInGroup = 0;
        let bugGroupSize = remainingBugs === 4 ? 2 : Math.min(3, remainingBugs);
        let gruntsLeft = survival ? config.composition!.filter(type => type === EnemyType.GRUNT).length : 0;
        let gruntGroupLeft = 0, gruntIndex = 0, gruntGroup = 0, gruntSide = side;
        let gruntAnchor = 0;

        for (let i = 0; i < config.count; i++) {
            // Keep one type draw per enemy so seeded position streams remain stable.
            const typeRoll = this.random();
            const type = config.composition?.[i] ?? config.types[Math.floor(typeRoll * config.types.length)];
            if (survival) {
                if (type === EnemyType.GRUNT) {
                    if (gruntGroupLeft === 0) {
                        let size = Math.min(gruntsLeft, 2 + Math.floor(this.random() * 5));
                        if (gruntsLeft - size === 1) size = size === 6 ? 5 : size + 1;
                        gruntGroupLeft = size;
                        gruntIndex = 0;
                        // Broad entry band with overlapping subgroups. Most keep
                        // feeding the main front; a minority pressure the other side.
                        gruntAnchor = .25 + ((gruntGroup + this.currentWaveIndex) % 3) * .25 + (this.random() - .5) * .08;
                        gruntSide = gruntGroup === 0 || this.random() < .7 ? side : side ^ 1;
                        gruntGroup++;
                    }
                    enemies.push(this.createPackEnemy(type, gruntSide, gruntAnchor, gruntIndex++));
                    gruntGroupLeft--; gruntsLeft--;
                    continue;
                }
                if (type === EnemyType.BUG) {
                    // Keep each pair/trio together at entry; later groups enter from
                    // the opposite flank instead of splitting a pair between edges.
                    const flank = (bugGroup + 1) % 2;
                    enemies.push(this.createPackEnemy(type, flank ? side ^ 1 : side, anchors[flank], bugInGroup));
                    bugInGroup++;
                    if (bugInGroup === bugGroupSize) {
                        remainingBugs -= bugGroupSize;
                        bugGroup++;
                        bugInGroup = 0;
                        bugGroupSize = remainingBugs === 4 ? 2 : Math.min(3, remainingBugs);
                    }
                    continue;
                }
                const pack = i < Math.ceil(config.count / 2) ? 0 : 1;
                enemies.push(this.createPackEnemy(type, pack ? side ^ 1 : side, anchors[pack], i % Math.ceil(config.count / 2)));
            } else enemies.push(this.createEnemy(type));
        }

        // A missed minute never skips the next identity or spawns late between minute marks.
        if (survival && (this.currentWaveIndex + 1) % BOSS_WAVE_INTERVAL === 0 &&
            !bossOccupied && (!this.lastBoss || this.lastBoss.isDead) && this.nextBossIndex < BOSS_SEQUENCE.length) {
            const type = BOSS_SEQUENCE[this.nextBossIndex++];
            this.lastBoss = this.createPackEnemy(type, side, .5, 0);
            enemies.push(this.lastBoss);
        }

        this.currentWaveIndex++;
        return enemies;
    }

    private createPackEnemy(type: EnemyType, side: number, anchor: number, index: number): Enemy {
        const viewport = this.viewport();
        const { width, height } = viewport;
        const grunt = type === EnemyType.GRUNT;
        // Arrival timing belongs to the release queue, not long invisible columns.
        const offset = 40 + Math.floor(index / 3) * (grunt ? 24 : 35);
        side = this.availableIngressSide(side, viewport, offset);
        const spread = (index % 3 - 1) * (grunt ? 55 : 38) + (this.random() - .5) * 14;
        const y = Math.max(35, Math.min(height - 35, anchor * height + spread));
        const x = Math.max(35, Math.min(width - 35, anchor * width + spread));
        return this.createWorldEnemy(type, viewport,
            side === 2 ? -offset : side === 3 ? width + offset : x,
            side === 0 ? -offset : side === 1 ? height + offset : y);
    }

    private createEnemy(type: EnemyType): Enemy {
        const viewport = this.viewport();
        const position = this.getRandomPosition(viewport);
        return this.createWorldEnemy(type, viewport, position.x, position.y);
    }

    private getRandomPosition(viewport: SpawnViewport): { x: number; y: number } {
        const { width, height } = viewport;
        const offset = 50;
        const side = this.availableIngressSide(Math.floor(this.random() * 4), viewport, offset);
        switch (side) {
            case 0: return { x: this.random() * width, y: -offset };
            case 1: return { x: this.random() * width, y: height + offset };
            case 2: return { x: -offset, y: this.random() * height };
            case 3: return { x: width + offset, y: this.random() * height };
            default: return { x: 0, y: 0 };
        }
    }

    private availableIngressSide(side: number, viewport: SpawnViewport, offset: number): number {
        if (viewport.x === undefined || viewport.y === undefined) return side;
        const arena = getArenaSize();
        const border = isArenaConfigured() ? ARENA_BORDER : 0;
        const free = [viewport.y - border, arena.height - border - viewport.y - viewport.height,
            viewport.x - border, arena.width - border - viewport.x - viewport.width];
        if (free[side] >= offset + 40) return side;
        for (const candidate of [side ^ 1, (side + 2) % 4, (side + 3) % 4]) {
            if (free[candidate] >= offset + 40) return candidate;
        }
        return side;
    }

    private createWorldEnemy(type: EnemyType, viewport: SpawnViewport, x: number, y: number): Enemy {
        const enemy = new Enemy(x + (viewport.x ?? 0), y + (viewport.y ?? 0), type);
        if (viewport.x === undefined || viewport.y === undefined) return enemy;
        const arena = getArenaSize();
        const inset = enemy.radius + (isArenaConfigured() ? ARENA_BORDER : 0);
        enemy.x = Math.max(Math.min(inset, arena.width / 2), Math.min(arena.width - inset, enemy.x));
        enemy.y = Math.max(Math.min(inset, arena.height / 2), Math.min(arena.height - inset, enemy.y));
        return enemy;
    }
}
