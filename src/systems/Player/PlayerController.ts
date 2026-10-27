import { drawPlasmaCharge } from '@/rendering/PlasmaEffects';
import { DUAL_WEAPON_OFFSET, muzzlePosition } from '@/rendering/WeaponGeometry';
import { InputSystem } from '@/systems/InputSystem.ts';
import { PlayerInputController } from '@/systems/Player/PlayerInputController.ts';
import { PlayerMovementController } from '@/systems/Player/PlayerMovementController.ts';
import { PlayerStatsController } from '@/systems/Player/PlayerStatsController';
import { PlayerWeaponController } from '@/systems/Player/PlayerWeaponController.ts';
import { Bullet } from '@entities/bullet/Bullet.ts';
import { compact } from '@/core/compact';
import type { IGameEntity } from '@entities/interfaces';
import { drawCharacter } from '@/rendering/CharacterArt';
import { drawWeaponHUD } from '@/ui/WeaponHUD';
import type { IWeapon } from '@/entities/weapon/IWeapon';
import { Player } from '@entities/player/Player.ts';
import { BonusHUD } from '@/ui/BonusHUD';
import type { PickupKind } from '@/gameplay/Pickups';
import type { PickupDrop, PickupTier } from '@/gameplay/PickupVariants';
import type { AmmoCategory } from '@/gameplay/WeaponLoot';
import type { WeaponId } from '@/gameplay/ids';
import { createWeapon } from '@/entities/weapon/WeaponFactory';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';

const AMMO_LABELS: Record<AmmoCategory, string> = {
    shotgun: 'Дробовые патроны', automatic: 'Автоматные патроны',
    special: 'Особые боеприпасы', scientific: 'Энергетический заряд',
};

export class PlayerController implements IGameEntity {
    private simulationTime = 0;
    private bonusHUD = new BonusHUD();
    private player: Player;
    private movementController: PlayerMovementController;
    private weaponController: PlayerWeaponController;
    private inputController = new PlayerInputController();
    private statsController = new PlayerStatsController();
    private input: InputSystem;
    private onFireVisualEffect: ((x: number, y: number, angle: number) => void) | null = null;

    constructor(player: Player, input: InputSystem, weapons: readonly (IWeapon | null)[],
        private readonly createRunWeapon: (id: WeaponId) => IWeapon = createWeapon) {
        this.weaponController = new PlayerWeaponController(weapons, () => this.simulationTime);
        this.input = input;
        this.player = player;
        this.movementController = new PlayerMovementController(player, input);
    }

    update(deltaMs = 1000 / 60) {
        this.simulationTime += deltaMs;
        this.player.updatePickupHealing(deltaMs);
        this.player.updateRegeneration(deltaMs);
        this.player.updateBonuses(deltaMs);
        this.bonusHUD.update(deltaMs, this.player.bonusProgress, this.player.bonusOrder, this.player.bonusTiers);
        this.weaponController.setPickupModifiers(this.player.pickupDamageMultiplier, this.player.pickupAttackSpeed);
        // Обрабаотчик передвижения
        this.movementController.update();
        const mouse = this.inputController.getMousePosition();
        this.player.angle = Math.atan2(mouse.y - this.player.y, mouse.x - this.player.x);
        this.player.weapon = this.weaponController.selectedWeapon.id;
        this.player.recoil *= .7;
        // Обработчик выстрела
        this.handleShooting();
        this.player.weapon = this.weaponController.selectedWeapon.id;

        const bullets = this.weaponController.getBullets();
        bullets.forEach(bullet => bullet.update(deltaMs));

    }

    public cleanupBullets(): void {
        compact(this.weaponController.getBullets(), bullet => {
            if (!bullet.isDead && !bullet.expired) return true;
            if (!bullet.hitRegistered) this.statsController.registerMiss();
            return false;
        });
    }


    draw(ctx: CanvasRenderingContext2D) {
        // Рисуем пули
        this.weaponController.getBullets().forEach(bullet => bullet.draw(ctx));
        // Рисуем персонажа
        const p = this.player;
        drawCharacter(ctx, p.character, p.weapon, p.x, p.y, p.angle, 1, p.recoil, this.weaponController.hasDualWeapons);
        this.drawBonuses(ctx);
        const charging = this.weaponController.selectedWeapon;
        if (charging.id === 'plasma-cannon' && charging.chargeProgress > 0) {
            const m = muzzlePosition(charging.id, p.x, p.y, p.angle, p.character), progress = charging.chargeProgress;
            drawPlasmaCharge(ctx, m.x, m.y, progress);
            if (this.weaponController.hasDualWeapons) drawPlasmaCharge(ctx,
                m.x - Math.sin(p.angle) * DUAL_WEAPON_OFFSET, m.y + Math.cos(p.angle) * DUAL_WEAPON_OFFSET, progress);
        }
    }

    public drawHUD(ctx: CanvasRenderingContext2D): void {
        this.bonusHUD.draw(ctx);
        // Рисуем название текущего оружия
        drawWeaponHUD(ctx, this.weaponController.slots, this.weaponController.selectedIndex);
        // Отрисовка статистики
        this.statsController.drawStats(ctx);
        // Отрисовка курсора
        this.drawCursor(ctx);
    }

    public init(onFireVisualEffect: (x: number, y: number, angle: number) => void) {
        this.onFireVisualEffect = onFireVisualEffect;
    }

    public getBullets() {
        return this.weaponController.getBullets();
    }

    public setBullets(bullets: Bullet[]) {
        this.weaponController.setBullets(bullets);
    }

    public getPlayer() {
        return this.player;
    }

    public collectDrop(drop: PickupDrop): void {
        if (this.player.currentHp <= 0) return;
        if (drop.kind === 'ammo') {
            this.weaponController.replenishAmmo(drop.ammoCategory);
            this.bonusHUD.notifyEquipment(AMMO_LABELS[drop.ammoCategory], 'ammo');
        } else if (drop.kind === 'weapon') {
            const weapon = this.createRunWeapon(drop.weaponId);
            this.weaponController.setPickupModifiers(this.player.pickupDamageMultiplier, this.player.pickupAttackSpeed);
            const acquired = this.weaponController.acquireWeapon(weapon);
            this.player.weapon = this.weaponController.selectedWeapon.id;
            const category = WEAPON_DEFINITIONS[weapon.id].category;
            if (acquired === 'ammo' && category !== 'sidearm') {
                this.bonusHUD.notifyEquipment(AMMO_LABELS[category], 'ammo');
            } else if (acquired === 'weapon') this.bonusHUD.notifyEquipment(weapon.name, 'weapon');
        } else this.collectPickup(drop.kind, drop.tier);
    }

    public collectPickup(kind: Exclude<PickupKind, 'ammo' | 'weapon'>, tier: PickupTier = 'silver', activated = false): void {
        if (this.player.currentHp <= 0) return;
        if (kind === 'health') this.player.startPickupHealing(tier === 'gold' ? 100 : 50);
        else if (kind !== 'iceBlast' && kind !== 'fireBlast') this.player.activateBonus(kind, tier);
        this.bonusHUD.notifyPickup(kind, tier, activated);
        this.bonusHUD.update(0, this.player.bonusProgress, this.player.bonusOrder, this.player.bonusTiers);
        this.weaponController.setPickupModifiers(this.player.pickupDamageMultiplier, this.player.pickupAttackSpeed);
    }

    private drawBonuses(ctx: CanvasRenderingContext2D): void {
        const p = this.player, active = p.activeBonuses;
        ctx.save();
        if (active.shield > 0) {
            ctx.save();
            // Blink during the final three simulation seconds; pauses freeze the effect.
            if (active.shield < 3000) {
                const phase = (3000 - active.shield) / 400 * Math.PI * 2;
                ctx.globalAlpha *= .15 + .85 * (1 + Math.cos(phase)) / 2;
            }
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 13, 0, Math.PI * 2);
            ctx.fillStyle = '#f4db5320'; ctx.fill();
            ctx.strokeStyle = '#ffe775'; ctx.lineWidth = 2.5;
            ctx.shadowColor = '#f4ca32'; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
            ctx.restore();
        }
        ctx.restore();
    }

    public setDualWeaponsActive(active: boolean): void { this.weaponController.setDualWeaponsActive(active); }

    public switchToWeapon(index: number): void {
        this.weaponController.switchToWeapon(index);
        this.player.weapon = this.weaponController.selectedWeapon.id;
    }

    public cycleWeapon(direction: -1 | 1): void {
        this.weaponController.cycleWeapon(direction);
        this.player.weapon = this.weaponController.selectedWeapon.id;
    }
    public stopShooting(): void {
        this.inputController.reset();
        this.weaponController.resetTrigger();
    }
    public registerProjectiles(count: number): void { this.statsController.registerShot(count); }

    public registerHit(): void {
        this.statsController.registerHit();
    }

    private handleShooting() {


        const mousePos = this.inputController.getMousePosition();
        const angle = Math.atan2(mousePos.y - this.player.y, mousePos.x - this.player.x);

        const fired = this.weaponController.tryShoot(
            this.player.x,
            this.player.y,
            angle,
            this.onFireVisualEffect ?? undefined,
            this.inputController.getIsShooting(),
        );

        // Регистрируем выстрел
        if (fired) {
            this.player.recoil = 3;
            this.statsController.registerShot(fired.length);
        }
    }

    public registerKill(): void {
        this.statsController.registerKill();
    }

    public getKillCount() {
        return this.statsController.getKillCount();
    }

    public getStats() {
        return this.statsController.snapshot();
    }

    public resetInput() {
        this.weaponController.resetTrigger();
        this.input.reset();
        this.inputController.reset();
    }

    public dispose() {
        this.input.dispose();
        this.inputController.dispose();
    }

    private drawCursor(ctx: CanvasRenderingContext2D) {
        const radius = 10;
        const mousePos = this.inputController.getMousePosition();
        const centerX = mousePos.x;
        const centerY = mousePos.y;

        this.drawCursorUI(ctx, radius, centerX, centerY);
        this.drawCooldownUI(ctx, radius, centerX, centerY);
    }

    private drawCursorUI(ctx: CanvasRenderingContext2D, radius: number, centerX: number, centerY: number) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#edd937';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    private drawCooldownUI(ctx: CanvasRenderingContext2D, radius: number, centerX: number, centerY: number) {
        // Получаем прогресс перезарядки
        const progress = this.weaponController.getCursorProgress();

        if (progress !== null && progress < 1) {
            const outerRadius = radius + 10; // чуть дальше основного курсора
            const startAngle = -Math.PI / 2; // начинается с "12 часов"
            const endAngle = startAngle + (Math.PI * 2 * progress);

            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 6;
            ctx.stroke();
        }
    }

    public get isMoving(): boolean { return this.movementController.moving; }
    public get acquiredAmmoCategories(): readonly AmmoCategory[] { return this.weaponController.acquiredAmmoCategories; }
    public get hasAmmoWeapons(): boolean { return this.weaponController.slots.some(weapon => weapon !== null && weapon.id !== 'pistol'); }
}


