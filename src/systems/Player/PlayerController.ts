import { drawPlasmaCharge } from '@/rendering/PlasmaEffects';
import { muzzlePosition } from '@/rendering/WeaponGeometry';
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

export class PlayerController implements IGameEntity {
    private simulationTime = 0;
    private player: Player;
    private movementController: PlayerMovementController;
    private weaponController: PlayerWeaponController;
    private inputController = new PlayerInputController();
    private statsController = new PlayerStatsController();
    private input: InputSystem;
    private onFireVisualEffect: ((x: number, y: number, angle: number) => void) | null = null;

    constructor(player: Player, input: InputSystem, weapons: readonly (IWeapon | null)[]) {
        this.weaponController = new PlayerWeaponController(weapons, () => this.simulationTime);
        this.input = input;
        this.player = player;
        this.movementController = new PlayerMovementController(player, input);
    }

    update(deltaMs = 1000 / 60) {
        this.simulationTime += deltaMs;
        // Обрабаотчик передвижения
        this.movementController.update();
        const mouse = this.inputController.getMousePosition();
        this.player.angle = Math.atan2(mouse.y - this.player.y, mouse.x - this.player.x);
        this.player.weapon = this.weaponController.selectedWeapon.id;
        this.player.recoil *= .7;
        // Обработчик выстрела
        this.handleShooting();

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
        drawCharacter(ctx, p.character, p.weapon, p.x, p.y, p.angle, 1, p.recoil);
        const charging = this.weaponController.selectedWeapon;
        if (charging.id === 'plasma-cannon' && charging.chargeProgress > 0) {
            const m = muzzlePosition(charging.id, p.x, p.y, p.angle, p.character), progress = charging.chargeProgress;
            drawPlasmaCharge(ctx, m.x, m.y, progress);
        }
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
}


