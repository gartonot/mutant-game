import { GroundStampQueue } from '@/effects/GroundStampQueue';
import { emitSound } from '@/audio/SoundEvents';
import { prepareBloodDecal, warmBloodDecalWorkers } from '@/effects/BloodDecalWorkerPool';
import { compact } from '@/core/compact';
import { CHARACTER_ABILITIES, CharacterAbilityClock } from '@/gameplay/CharacterAbilities';
import { ExtendedCharacterAbilities } from '@/gameplay/ExtendedCharacterAbilities';
import { drawAbilityHUD } from '@/ui/AbilityHUD';
import { ConsumableInventory } from '@/gameplay/ConsumableInventory';
import type { ConsumableSelection } from '@/gameplay/Consumables';
import type { PickupTier } from '@/gameplay/PickupVariants';
import { drawConsumableHUD } from '@/ui/ConsumableHUD';
import { getArenaSize } from '@/gameplay/Arena';
import { applyPickupBlast, getPickupBlast } from '@/gameplay/PickupBlasts';
import { PickupWaveEffect } from '@/effects/PickupWaveEffect';
import { PickupExplosionEffect } from '@/effects/PickupExplosionEffect';
import { drawScorchMark } from '@/effects/ScorchMark';
import { ExplosionEffect } from '@/effects/ExplosionEffect';
import { FearWaveEffect } from '@/effects/FearWaveEffect';
import { ArtilleryImpactEffect } from '@/effects/ArtilleryImpactEffect';
import { ArtilleryGroundMark } from '@/effects/ArtilleryGroundMark';
import { ZombieDeathEffect } from '@/effects/ZombieDeathEffect';
import { MuzzleFlashEffect } from '@/effects/MuzzleFlashEffect.ts';
import { Enemy } from '@/entities/enemy/Enemy';
import { isBossType } from '@/entities/enemy/EnemyType';
import { BOSS_SEQUENCE } from '@/systems/WaveSystem/WaveConfig';
import { OrdinaryEnemyMechanics } from '@/gameplay/OrdinaryEnemyMechanics';
import { EnemyArrivalQueue } from '@/gameplay/EnemyArrivalQueue';
import { BossEncounter } from '@/gameplay/BossEncounter';
import { constrainPlayerToArena } from '@/systems/spatial/playerBounds';
import { CollisionSystem } from '@/systems/CollisionSystem';
import type { PlayerController } from '@/systems/Player/PlayerController';
import { EnemySeparation } from '@/systems/spatial/EnemySeparation';
import { resolvePlayerContact } from '@/systems/spatial/playerContact';
import { UIRenderer } from '@/systems/UIRenderer';
import { WaveSystem } from '@/systems/WaveSystem/WaveSystem';
import type { IGameEntity } from '@entities/interfaces';
import { Pickup } from '@/gameplay/Pickups';
import { TelepathAttraction } from '@/gameplay/TelepathAttraction';
import { rollPickupDrop, rollWeaponDrop } from '@/gameplay/PickupDrops';
import { ALL_DROP_WEAPONS } from '@/gameplay/WeaponLoot';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import type { WeaponId } from '@/gameplay/ids';
import { DEFAULT_UNLOCKED_GOLD_PICKUPS, type GoldPickupKind } from '@/gameplay/PickupVariants';

export class GameWorld implements IGameEntity {
    public static readonly DURATION_MS = 6 * 60 * 1000;
    public get remainingMs() { return Math.max(0, GameWorld.DURATION_MS - this.elapsed); }
    public get isVictory() { return this.remainingMs === 0 && this.controller.getPlayer().currentHp > 0; }
    private waveSystem: WaveSystem;
    private readonly enemyArrivals: EnemyArrivalQueue;
    private enemies: Enemy[] = [];
    private readonly ordinaryEnemies = new OrdinaryEnemyMechanics();
    private readonly bossEncounter: BossEncounter;
    private controller: PlayerController;
    private uiRenderer: UIRenderer;
    private collisionSystem = new CollisionSystem();
    private muzzleFlashes: MuzzleFlashEffect[] = [];
    private explosions: ExplosionEffect[] = [];
    private fearWaves: FearWaveEffect[] = [];
    private artilleryImpacts: ArtilleryImpactEffect[] = [];
    private artilleryMarks: ArtilleryGroundMark[] = [];
    private pickupWaves: PickupWaveEffect[] = [];
    private pickupExplosions: PickupExplosionEffect[] = [];
    private deathEffects: ZombieDeathEffect[] = [];
    private pickups: Pickup[] = [];
    private readonly telepathAttraction = new TelepathAttraction();
    private bloodLayer?: HTMLCanvasElement;
    private readonly groundStamps = new GroundStampQueue();
    private readonly consumables: ConsumableInventory;
    private readonly abilityClock: CharacterAbilityClock;
    private readonly extendedAbilities: ExtendedCharacterAbilities;
    private artilleryBursts: { x: number; y: number; delayMs: number }[] = [];
    public get abilityState() {
        const state = this.abilityClock.state;
        return state ? { ...state, character: this.controller.getPlayer().character } : null;
    }
    public get consumableSlots() { return this.consumables.slots; }

    private stampBlood(effect: ZombieDeathEffect) {
        effect.deferUntilPrepared();
        let accepted = false;
        this.groundStamps.enqueueAsync(prepareBloodDecal(effect.groundInput(true)),
            (ctx, prepared) => {
                effect.acceptPrepared(prepared);
                accepted = true;
                effect.drawGround(ctx, prepared);
            }, prepared => {
                prepared.canvas.close();
                if (!accepted) prepared.remains?.canvas.close();
            });
    }

    private stampGround(draw: (ctx: CanvasRenderingContext2D) => void) {
        this.groundStamps.enqueue(draw);
    }

    private applyGround(draw: (ctx: CanvasRenderingContext2D) => void) {
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
        draw(this.bloodLayer.getContext('2d')!);
    }
    private separation = new EnemySeparation();
    private elapsed = 0;
    private wavesStarted = 0;
    private bossesKilled = 0;
    private lastVisiblePlayer = { x: 0, y: 0 };

    constructor(controller: PlayerController, private readonly random = Math.random,
        private readonly unlockedGoldPickups: readonly GoldPickupKind[] = DEFAULT_UNLOCKED_GOLD_PICKUPS,
        private readonly unlockedWeapons: readonly WeaponId[] = ALL_DROP_WEAPONS,
        consumables: readonly ConsumableSelection[] = [], consumableSlotsUnlocked?: number,
        waveRandom: () => number = random) {
        this.waveSystem = new WaveSystem({ random: waveRandom });
        this.enemyArrivals = new EnemyArrivalQueue(waveRandom);
        this.bossEncounter = new BossEncounter(waveRandom);
        this.controller = controller;
        this.lastVisiblePlayer = { x: controller.getPlayer().x, y: controller.getPlayer().y };
        warmBloodDecalWorkers();
        this.abilityClock = new CharacterAbilityClock(CHARACTER_ABILITIES[controller.getPlayer().character]);
        this.extendedAbilities = new ExtendedCharacterAbilities(controller.getPlayer(), () => this.enemies,
            () => controller.getAimPosition());
        this.consumables = new ConsumableInventory(consumables, consumableSlotsUnlocked);

        this.uiRenderer = new UIRenderer(this.controller.getPlayer());
    }

    update(deltaMs = 1000 / 60) {
        if (this.remainingMs === 0 || this.controller.getPlayer().currentHp <= 0) return;
        deltaMs = Math.min(deltaMs, this.remainingMs);
        const wasActive = (this.abilityState?.remainingActiveMs ?? 0) > 0;
        this.abilityClock.update(deltaMs);
        if (wasActive && this.abilityState?.remainingActiveMs === 0 && this.controller.getPlayer().character === 'mercenary') {
            this.controller.setDualWeaponsActive(false);
        }
        for (const burst of this.artilleryBursts) burst.delayMs -= deltaMs;
        compact(this.artilleryBursts, burst => {
            if (burst.delayMs > 0) return true;
            this.spawnArtilleryImpact(burst.x, burst.y);
            return false;
        });
        this.elapsed += deltaMs;
        if (this.remainingMs === 0) {
            this.uiRenderer.update(0);
            return;
        }
        // Bring only the opening pack forward; later packs and minute bosses keep their schedule.
        const nextWaveAt = this.wavesStarted === 0 ? 3000 : (this.wavesStarted + 1) * 5000;
        if (this.elapsed >= nextWaveAt) {
            const spawned = this.waveSystem.spawnWave(this.bossEncounter.occupied);
            for (const enemy of spawned) if (isBossType(enemy.type)) {
                this.bossEncounter.registerBoss(enemy);
                this.enemies.push(enemy);
            }
            this.enemyArrivals.schedule(spawned.filter(enemy => !isBossType(enemy.type)),
                this.elapsed, this.wavesStarted === 0 ? 6000 : 4500);
            this.wavesStarted++;
        }
        this.enemies.push(...this.enemyArrivals.release(this.elapsed));
        // Input and projectile motion precede collision detection in the same tick.
        this.controller.update(deltaMs);
        this.extendedAbilities.update(deltaMs);
        if (['hunter', 'silver-hunter'].includes(this.controller.getPlayer().character) && !this.extendedAbilities.isActive) {
            this.abilityClock.endActive();
        }
        const player = this.controller.getPlayer();
        const arena = getArenaSize();
        if (!player.abilityInvisible) this.lastVisiblePlayer = { x: player.x, y: player.y };
        for (const enemy of this.enemies) enemy.setTarget(this.lastVisiblePlayer.x, this.lastVisiblePlayer.y);
        this.ordinaryEnemies.update(deltaMs, this.enemies, player, {
            applySlow: (duration, factor) => player.applyEnemySlow(duration, factor),
        });
        this.bossEncounter.update(deltaMs, player, arena, {
            damagePlayer: amount => player.takeDamage(amount),
            pullPlayer: (x, y, lockMs) => {
                player.x = x; player.y = y; player.applyEnemyRoot(lockMs);
                constrainPlayerToArena(player, arena.width, arena.height);
            },
        });
        for (const enemy of this.enemies) {
            enemy.update(deltaMs);
            if (enemy.isDead) continue;
            if (!enemy.contactDisabled && !enemy.isFeared && !player.abilityInvisible) resolvePlayerContact(player, enemy, this.controller.isMoving, this.elapsed, window.innerWidth, window.innerHeight);
        }
        this.collisionSystem.checkBulletEnemyCollisions(this.controller, this.enemies,
            (x, y, radius, plasma, variant) => {
                emitSound(variant === 'skull' ? 'bone-break' : variant === 'plasma' ? 'plasma-explosion' : 'explosion');
                this.explosions.push(new ExplosionEffect(x, y, radius, plasma));
                if (variant === 'normal') this.stampGround(ctx => drawScorchMark(ctx, x, y, 35));
            });
        this.processEnemyDeaths();
        if (player.character === 'telepath') {
            this.telepathAttraction.update(deltaMs, this.pickups, this.controller.getAimPosition(), true);
        }
        for (const pickup of this.pickups) pickup.update(deltaMs,
            arena, player);
        compact(this.pickups, pickup => {
            if (pickup.expired) return false;
            if (!pickup.canCollect(player)) return true;
            if (pickup.kind === 'ammo') {
                if (pickup.ammoCategory) this.controller.collectDrop({ kind: 'ammo', tier: 'silver', ammoCategory: pickup.ammoCategory });
            } else if (pickup.kind === 'weapon') {
                if (pickup.weaponId) this.controller.collectDrop({ kind: 'weapon', tier: 'silver', weaponId: pickup.weaponId });
            } else {
                this.applyBonus(pickup.kind, pickup.tier, pickup.x, pickup.y);
            }
            return false;
        });
        // Remove blast victims only after compacting pickups, so new drops cannot be
        // overwritten by that in-place iteration or collected in the same tick.
        this.processEnemyDeaths();
        this.controller.cleanupBullets();
        this.separation.resolve(this.enemies);
        for (const effect of this.deathEffects) effect.update(deltaMs);
        compact(this.deathEffects, effect => {
            if (effect.isExpired) { effect.dispose(); return false; }
            return true;
        });
        for (const effect of this.pickupWaves) effect.update(deltaMs);
        for (const effect of this.fearWaves) effect.update(deltaMs);
        compact(this.fearWaves, effect => !effect.isExpired);
        compact(this.pickupWaves, effect => !effect.isExpired);
        for (const effect of this.pickupExplosions) effect.update(deltaMs);
        compact(this.pickupExplosions, effect => !effect.isExpired);
        for (const effect of this.artilleryImpacts) effect.update(deltaMs);
        compact(this.artilleryImpacts, effect => !effect.isExpired);
        for (const mark of this.artilleryMarks) mark.update(deltaMs);
        compact(this.artilleryMarks, mark => !mark.isExpired);
        for (const effect of this.explosions) effect.update();
        compact(this.explosions, effect => !effect.isExpired);
        for (const flash of this.muzzleFlashes) flash.update(deltaMs);
        compact(this.muzzleFlashes, flash => !flash.isExpired);
        this.uiRenderer.update(this.remainingMs);
    }

    public activateAbility(): boolean {
        const player = this.controller.getPlayer();
        if (player.currentHp <= 0 || this.remainingMs === 0 || !this.abilityClock.activate()) return false;
        const blast = getPickupBlast('fireBlast');
        if (player.character === 'destroyer') {
            const width = window.innerWidth, height = window.innerHeight;
            for (const enemy of this.enemies) {
                if (enemy.x + enemy.radius < 0 || enemy.x - enemy.radius > width ||
                    enemy.y + enemy.radius < 0 || enemy.y - enemy.radius > height) continue;
                enemy.receiveDamage(blast.damage, Math.atan2(enemy.y - player.y, enemy.x - player.x), 0);
            }
            const columns = Math.min(3, Math.max(2, Math.ceil(width / 520)));
            const rows = 2;
            const points: { x: number; y: number; order: number }[] = [];
            for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
                const seed = col * 17 + row * 31;
                const x = (col + .5 + Math.sin(seed + 2) * .2) * width / columns;
                const y = (row + .5 + Math.sin(seed + 7) * .2) * height / rows;
                points.push({ x, y, order: Math.sin(seed + 13) });
            }
            // Separate local impacts in time instead of overlapping screen-wide fireballs.
            points.sort((a, b) => a.order - b.order).forEach(({ x, y }, index) => {
                if (index === 0) this.spawnArtilleryImpact(x, y);
                else this.artilleryBursts.push({ x, y, delayMs: index * 140 });
            });
            this.processEnemyDeaths();
        } else if (player.character === 'assassin') {
            this.fearWaves.push(new FearWaveEffect(player.x, player.y, blast.radius));
            for (const enemy of this.enemies) {
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) <= blast.radius) {
                    enemy.applyFear(CHARACTER_ABILITIES.assassin!.durationMs, player.x, player.y);
                }
            }
        } else if (player.character === 'mercenary') {
            this.controller.setDualWeaponsActive(true);
        } else {
            this.lastVisiblePlayer = { x: player.x, y: player.y };
            this.extendedAbilities.activate();
            this.processEnemyDeaths();
        }
        return true;
    }

    private spawnArtilleryImpact(x: number, y: number): void {
        this.artilleryImpacts.push(new ArtilleryImpactEffect(x, y, 145));
        this.artilleryMarks.push(new ArtilleryGroundMark(x, y, 48));
        if (this.artilleryMarks.length > 24) this.artilleryMarks.shift();
    }

    public activateConsumable(slotIndex: number): boolean {
        const player = this.controller.getPlayer();
        if (player.currentHp <= 0 || this.remainingMs === 0) return false;
        const selection = this.consumables.consume(slotIndex);
        if (!selection) return false;
        this.applyBonus(selection.kind, selection.tier, player.x, player.y, true);
        this.processEnemyDeaths();
        return true;
    }

    /** Shared by ground pickups and manual charges, including blast visuals and damage. */
    private applyBonus(kind: GoldPickupKind, tier: PickupTier, x: number, y: number, activated = false): void {
        this.controller.collectPickup(kind, tier, activated);
        if (kind !== 'iceBlast' && kind !== 'fireBlast') return;
        const blast = applyPickupBlast(kind, tier, x, y, this.enemies);
        if (kind === 'fireBlast') {
            emitSound('explosion');
            this.stampGround(ctx => drawScorchMark(ctx, x, y, 55));
            this.pickupExplosions.push(new PickupExplosionEffect(x, y, blast.radius));
        } else {
            emitSound('ice-explosion');
            this.pickupWaves.push(new PickupWaveEffect(x, y, blast.radius, kind, tier));
        }
    }

    private processEnemyDeaths() {
        const player = this.controller.getPlayer();
        compact(this.enemies, enemy => {
            if (!enemy.isDead) return true;
            this.ordinaryEnemies.onDeath(enemy);
            const burst = isBossType(enemy.type) ? undefined : enemy.deathBurst;
            if (burst) {
                // Only airborne particles are capped; every stain persists in the map layer.
                if (this.deathEffects.length >= 100) this.deathEffects.shift()?.dispose();
                const effect = new ZombieDeathEffect(burst.x, burst.y, burst.radius, burst.angle, burst.palette);
                this.stampBlood(effect);
                this.deathEffects.push(effect);
            }
            this.controller.registerKill();
            if (isBossType(enemy.type)) this.bossesKilled++;
            const drop = rollPickupDrop(this.random, this.unlockedGoldPickups, this.controller.acquiredAmmoCategories);
            const weaponId = rollWeaponDrop(this.random, this.unlockedWeapons, this.controller.acquiredAmmoCategories);
            const origin = enemy.deathBurst ?? enemy;
            if (drop) {
                this.pickups.push(new Pickup(drop.kind, origin.x - (weaponId ? 20 : 0), origin.y, player.x, player.y,
                    enemy.radius, player.bonusGroundDuration,
                    getArenaSize(), drop.tier,
                    drop.kind === 'ammo' ? drop.ammoCategory : undefined));
            }
            if (weaponId) {
                this.pickups.push(new Pickup('weapon', origin.x + (drop ? 20 : 0), origin.y, player.x, player.y,
                    enemy.radius, player.bonusGroundDuration,
                    getArenaSize(), 'silver', undefined, weaponId));
            }
            return false;
        });
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.groundStamps.pendingCount) this.applyGround(layer => this.groundStamps.flush(layer));
        if (this.bloodLayer) ctx.drawImage(this.bloodLayer, 0, 0);
        this.artilleryMarks.forEach(mark => mark.draw(ctx));
        this.extendedAbilities.drawGroundEffects(ctx);
        this.ordinaryEnemies.drawGround(ctx);
        this.bossEncounter.drawGround(ctx);
        const acquiredCategories = this.controller.acquiredAmmoCategories;
        this.pickups.forEach(pickup => {
            // Read current inventory: another drop in this category may have been
            // collected since this weapon landed, turning it into an ammo refill.
            const category = pickup.weaponId ? WEAPON_DEFINITIONS[pickup.weaponId].category : undefined;
            const categoryOwned = category !== undefined && category !== 'sidearm'
                && acquiredCategories.includes(category);
            pickup.draw(ctx, categoryOwned);
        });
        this.fearWaves.forEach(effect => effect.draw(ctx));
        // Отрисовываем врагов
        this.enemies.forEach(enemy => enemy.draw(ctx));
        this.ordinaryEnemies.draw(ctx);
        this.bossEncounter.drawWorld(ctx);
        this.deathEffects.forEach(effect => effect.draw(ctx));
        this.explosions.forEach(effect => effect.draw(ctx));
        this.pickupWaves.forEach(effect => effect.draw(ctx));
        this.pickupExplosions.forEach(effect => effect.draw(ctx));
        this.artilleryImpacts.forEach(effect => effect.draw(ctx));

        // Отрисовываем вспышки от пуль
        this.muzzleFlashes.forEach(flash => flash.draw(ctx));
        this.controller.draw(ctx);
        this.extendedAbilities.draw(ctx);

        // All HUD elements render after every world object, including the player.
        this.uiRenderer.draw(ctx);
        this.controller.drawHUD(ctx);
        drawConsumableHUD(ctx, this.consumables.slots, this.consumables.unlockedSlots);
        drawAbilityHUD(ctx, this.abilityState);
        this.bossEncounter.drawHUD(ctx, window.innerWidth);
    }

    public addMuzzleFlash(x: number, y: number, angle: number) {
        this.muzzleFlashes.push(new MuzzleFlashEffect(x, y, angle));
    }

    public getPlayerController(): PlayerController {
        return this.controller;
    }

    public dispose() {
        this.artilleryBursts = [];
        this.artilleryImpacts = [];
        this.artilleryMarks = [];
        this.fearWaves = [];
        this.extendedAbilities.dispose();
        this.ordinaryEnemies.clear();
        this.bossEncounter.reset();
        this.groundStamps.dispose();
        for (const effect of this.deathEffects) effect.dispose();
        this.deathEffects = [];
    }

    public resume() { /* Simulation clocks advance only during update. */ }

    public getRunStats() {
        const stats = this.controller.getStats();
        return {
            ...stats,
            sharpshooterWins: this.isVictory && stats.shots > 0 && stats.preciseAccuracy >= 70
                && this.bossesKilled >= BOSS_SEQUENCE.length ? 1 : 0,
            seconds: this.elapsed / 1000,
            waves: Math.max(0, this.wavesStarted - 1),
            damage: this.controller.getPlayer().damageTaken,
        };
    }
}
