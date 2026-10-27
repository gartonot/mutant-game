import { compact } from '@/core/compact';
import { ExplosionEffect } from '@/effects/ExplosionEffect';
import { ZombieDeathEffect } from '@/effects/ZombieDeathEffect';
import { MuzzleFlashEffect } from '@/effects/MuzzleFlashEffect.ts';
import { Enemy } from '@/entities/enemy/Enemy';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { PlayerController } from '@/systems/Player/PlayerController';
import { EnemySeparation } from '@/systems/spatial/EnemySeparation';
import { resolvePlayerContact } from '@/systems/spatial/playerContact';
import { UIRenderer } from '@/systems/UIRenderer';
import { WaveSystem } from '@/systems/WaveSystem/WaveSystem';
import type { IGameEntity } from '@entities/interfaces';

export class GameWorld implements IGameEntity {
    private waveSystem = new WaveSystem();
    private enemies: Enemy[] = [];
    private controller: PlayerController;
    private uiRenderer: UIRenderer;
    private collisionSystem = new CollisionSystem();
    private muzzleFlashes: MuzzleFlashEffect[] = [];
    private explosions: ExplosionEffect[] = [];
    private deathEffects: ZombieDeathEffect[] = [];
    private bloodLayer?: HTMLCanvasElement;

    private stampBlood(effect: ZombieDeathEffect) {
        const width = window.innerWidth, height = window.innerHeight;
        if (!this.bloodLayer) this.bloodLayer = document.createElement('canvas');
        const layer = this.bloodLayer;
        if (layer.width < width || layer.height < height) {
            const resized = document.createElement('canvas');
            resized.width = Math.max(width, layer.width);
            resized.height = Math.max(height, layer.height);
            resized.getContext('2d')!.drawImage(layer, 0, 0);
            this.bloodLayer = resized;
        }
        effect.drawGround(this.bloodLayer.getContext('2d')!);
    }
    private waveElapsed = 0;
    private separation = new EnemySeparation();
    private elapsed = 0;
    private wavesStarted = 0;

    constructor(controller: PlayerController) {
        this.controller = controller;

        this.uiRenderer = new UIRenderer(this.controller.getPlayer());
    }

    update(deltaMs = 1000 / 60) {
        this.waveElapsed += deltaMs;
        this.elapsed += deltaMs;
        if (this.waveElapsed >= 5000) {
            this.enemies.push(...this.waveSystem.spawnWave());
            this.wavesStarted++;
            this.waveElapsed -= 5000;
        }
        // Input and projectile motion precede collision detection in the same tick.
        this.controller.update(deltaMs);
        const player = this.controller.getPlayer();
        for (const enemy of this.enemies) {
            enemy.setTarget(player.x, player.y);
            enemy.update(deltaMs);
            if (enemy.isDead) continue;
            resolvePlayerContact(player, enemy, this.controller.isMoving, this.elapsed, window.innerWidth, window.innerHeight);
        }
        this.collisionSystem.checkBulletEnemyCollisions(this.controller, this.enemies,
            (x, y, radius, plasma) => this.explosions.push(new ExplosionEffect(x, y, radius, plasma)));
        compact(this.enemies, enemy => {
            if (!enemy.isDead) return true;
            const burst = enemy.deathBurst;
            if (burst) {
                // Only airborne particles are capped; every stain persists in the map layer.
                if (this.deathEffects.length >= 100) this.deathEffects.shift();
                const effect = new ZombieDeathEffect(burst.x, burst.y, burst.radius, burst.angle, burst.palette);
                this.stampBlood(effect);
                this.deathEffects.push(effect);
            }
            this.controller.registerKill();
            return false;
        });
        this.controller.cleanupBullets();
        this.separation.resolve(this.enemies);
        for (const effect of this.deathEffects) effect.update(deltaMs);
        compact(this.deathEffects, effect => !effect.isExpired);
        for (const effect of this.explosions) effect.update();
        compact(this.explosions, effect => !effect.isExpired);
        for (const flash of this.muzzleFlashes) flash.update(deltaMs);
        compact(this.muzzleFlashes, flash => !flash.isExpired);
        this.uiRenderer.update();
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.bloodLayer) ctx.drawImage(this.bloodLayer, 0, 0);
        // Отрисовываем врагов
        this.enemies.forEach(enemy => enemy.draw(ctx));
        this.deathEffects.forEach(effect => effect.draw(ctx));
        this.explosions.forEach(effect => effect.draw(ctx));

        // Отрисовываем вспышки от пуль
        this.muzzleFlashes.forEach(flash => flash.draw(ctx));

        // Отрисовываем UI
        this.uiRenderer.draw(ctx);
    }

    public addMuzzleFlash(x: number, y: number, angle: number) {
        this.muzzleFlashes.push(new MuzzleFlashEffect(x, y, angle));
    }

    public getPlayerController(): PlayerController {
        return this.controller;
    }

    public resume() { /* Simulation clocks advance only during update. */ }

    public getRunStats() {
        return {
            ...this.controller.getStats(),
            seconds: this.elapsed / 1000,
            waves: Math.max(0, this.wavesStarted - 1),
            damage: this.controller.getPlayer().damageTaken,
        };
    }
}
