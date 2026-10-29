import { drawBonusArt } from '@/rendering/BonusArt';
import { getArenaSize } from './Arena';
import { drawAmmoArt } from '@/rendering/AmmoArt';
import { drawWeapon, WEAPON_ART } from '@/rendering/WeaponArt';
import type { AmmoCategory } from './WeaponLoot';
import type { WeaponId } from './ids';
import type { PickupTier } from './PickupVariants';
import { drawPickupGlow } from '@/rendering/PickupGlow';

export type PickupKind = 'ammo' | 'weapon' | 'health' | 'rapidFire' | 'moveSpeed' | 'doubleDamage' | 'shield' | 'iceBlast' | 'fireBlast';

export interface PickupViewport { width: number; height: number }

const WEAPON_PICKUP_SCALE = 0.7225;
const BONUS_PICKUP_SCALE = 0.935;

const COLORS: Record<PickupKind, string> = {
    ammo: '#ffd36c', weapon: '#99e6ff', health: '#ff6050', rapidFire: '#d3ef62',
    moveSpeed: '#69cfff', doubleDamage: '#ff8b69', shield: '#f4db53',
    iceBlast: '#75eaff', fireBlast: '#ff963d',
};

/** A drop travels toward the player's position at death, then waits for contact. */
export class Pickup {
    public readonly radius = 16;
    public x: number;
    public y: number;
    public expired = false;
    public attracted = false;
    public attractionProgress = 0;
    private ageMs = 0;
    private readonly flightMs = 400;
    private readonly lifetimeMs: number;
    private readonly startX: number;
    private readonly startY: number;
    private targetX: number;
    private targetY: number;
    private viewport: PickupViewport;

    constructor(
        public readonly kind: PickupKind,
        x: number, y: number, playerX: number, playerY: number,
        enemyRadius: number, groundDurationMultiplier = 1,
        viewport: PickupViewport = getArenaSize(),
        public readonly tier: PickupTier = 'silver',
        public readonly ammoCategory?: AmmoCategory,
        public readonly weaponId?: WeaponId,
    ) {
        this.x = this.startX = x;
        this.y = this.startY = y;
        this.viewport = viewport;
        this.lifetimeMs = 15000 * Math.max(0, groundDurationMultiplier);
        const dx = playerX - x;
        const dy = playerY - y;
        const distance = Math.hypot(dx, dy);
        const travel = Math.min(distance, Math.max(0, enemyRadius) * 5);
        this.targetX = x + (distance ? dx / distance * travel : 0);
        this.targetY = y + (distance ? dy / distance * travel : 0);
        this.clampTarget();
        this.clampPosition();
    }

    public get inFlight(): boolean { return this.ageMs < this.flightMs; }

    public update(deltaMs: number, viewport?: PickupViewport, attractionTarget?: { x: number; y: number }): void {
        if (this.expired) return;
        if (viewport) {
            this.viewport = viewport;
            this.clampTarget();
        }
        this.ageMs += Math.max(0, deltaMs);
        const t = Math.min(1, this.ageMs / this.flightMs);
        const eased = 1 - (1 - t) ** 2;
        if (this.attracted) {
            if (attractionTarget) {
                const dx = attractionTarget.x - this.x, dy = attractionTarget.y - this.y;
                const distance = Math.hypot(dx, dy);
                const fraction = distance ? Math.min(1, Math.max(0, deltaMs) * .6 / distance) : 0;
                this.x += dx * fraction;
                this.y += dy * fraction;
            }
        } else {
            this.x = this.startX + (this.targetX - this.startX) * eased;
            this.y = this.startY + (this.targetY - this.startY) * eased;
        }
        this.clampPosition();
        this.expired = this.ageMs >= this.flightMs + this.lifetimeMs;
    }

    public canCollect(player: { x: number; y: number; radius: number; currentHp: number }): boolean {
        return !this.expired && !this.inFlight && player.currentHp > 0
            && Math.hypot(player.x - this.x, player.y - this.y) <= player.radius + this.radius;
    }

    private clampTarget(): void {
        const clamp = (value: number, size: number) => size <= this.radius * 2
            ? Math.max(0, size / 2) : Math.max(this.radius, Math.min(size - this.radius, value));
        this.targetX = clamp(this.targetX, this.viewport.width);
        this.targetY = clamp(this.targetY, this.viewport.height);
    }

    private clampPosition(): void {
        const insetX = Math.min(this.radius, this.viewport.width / 2);
        const insetY = Math.min(this.radius, this.viewport.height / 2);
        this.x = Math.max(insetX, Math.min(this.viewport.width - insetX, this.x));
        this.y = Math.max(insetY, Math.min(this.viewport.height - insetY, this.y));
    }

    public draw(ctx: CanvasRenderingContext2D, weaponCategoryOwned = false): void {
        if (this.expired) return;
        const pickupScale = this.kind === 'weapon' ? WEAPON_PICKUP_SCALE : BONUS_PICKUP_SCALE;
        const remaining = this.flightMs + this.lifetimeMs - this.ageMs;
        const arc = this.inFlight ? Math.sin(Math.PI * this.ageMs / this.flightMs) * 22 : 0;
        ctx.save();
        ctx.globalAlpha = remaining < 3000 && Math.floor(this.ageMs / 150) % 2 ? 0.4 : 1;
        ctx.translate(this.x, this.y);
        if (this.attractionProgress > 0) {
            ctx.strokeStyle = '#bba0ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.attractionProgress);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 9 * pickupScale, 13 * pickupScale, 5 * pickupScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.translate(0, -arc);
        ctx.scale(pickupScale, pickupScale);
        if (this.kind === 'weapon' || this.kind === 'ammo') {
            const width = this.kind === 'ammo' ? 90 : this.weaponId === 'plasma-grenade' ? 100 : 120;
            drawPickupGlow(ctx, this.kind === 'ammo' || weaponCategoryOwned, width,
                this.ageMs, this.startX * .013 + this.startY * .019);
        }
        const visualScale = this.kind === 'weapon' ? 2.5 : 1.25;
        ctx.scale(visualScale, visualScale);
        ctx.shadowColor = this.kind === 'ammo' || (this.kind === 'weapon' && weaponCategoryOwned)
            ? '#65cfff' : this.kind === 'weapon' ? '#ffd66b' : COLORS[this.kind];
        ctx.shadowBlur = (10 + Math.sin(this.ageMs / 200) * 2) * pickupScale;
        if (this.kind === 'ammo' && this.ammoCategory && drawAmmoArt(ctx, this.ammoCategory, 0, 0, 38)) {
            ctx.restore();
            return;
        }
        if (this.kind === 'weapon' && this.weaponId) {
            // The round grenade needs less width than long guns to have comparable visual weight.
            const rear = this.weaponId === 'pistol' ? -2 : this.weaponId === 'plasma-grenade' ? 1 : -14;
            const muzzle = WEAPON_ART[this.weaponId].muzzle;
            const displayWidth = this.weaponId === 'plasma-grenade' ? 24 : 48;
            const scale = displayWidth / (muzzle - rear);
            ctx.rotate(-.25);
            ctx.scale(scale, scale);
            ctx.translate(-(rear + muzzle) / 2, 0);
            drawWeapon(ctx, this.weaponId);
            ctx.restore();
            return;
        }
        if (drawBonusArt(ctx, this.kind, 0, 0, this.radius * 2, this.tier)) {
            ctx.restore();
            return;
        }
        ctx.fillStyle = '#172329';
        ctx.strokeStyle = this.tier === 'gold' ? '#ffd34d' : COLORS[this.kind];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS[this.kind];
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.drawIcon(ctx);
        ctx.restore();
    }

    private drawIcon(ctx: CanvasRenderingContext2D): void {
        switch (this.kind) {
            case 'iceBlast':
                ctx.fillStyle = '#1dbfdf'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff35b'; ctx.beginPath();
                ctx.moveTo(0, -10); ctx.lineTo(2, -2); ctx.lineTo(9, 0); ctx.lineTo(2, 2);
                ctx.lineTo(0, 10); ctx.lineTo(-2, 2); ctx.lineTo(-9, 0); ctx.lineTo(-2, -2);
                ctx.closePath(); ctx.fill();
                break;
            case 'fireBlast':
                ctx.fillStyle = '#ef4318'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffe94d';
                for (let i = 0; i < 3; i++) {
                    ctx.save(); ctx.rotate(i * Math.PI * 2 / 3);
                    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -3); ctx.lineTo(-3, -3);
                    ctx.closePath(); ctx.fill(); ctx.restore();
                }
                break;
            case 'ammo':
            case 'weapon':
                // Neutral loading marker: never depict another category's ammunition.
                ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
                break;
            case 'health':
                ctx.fillStyle = '#ec241e'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#ffe34d'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(0, 1, 7, Math.PI, Math.PI * 2); ctx.stroke();
                break;
            case 'rapidFire':
                ctx.beginPath();
                ctx.moveTo(2, -10); ctx.lineTo(-7, 2); ctx.lineTo(-1, 2);
                ctx.lineTo(-3, 10); ctx.lineTo(8, -3); ctx.lineTo(2, -3);
                ctx.closePath(); ctx.fill();
                break;
            case 'moveSpeed':
                for (const y of [-5, 3]) {
                    ctx.beginPath(); ctx.moveTo(-7, y + 4); ctx.lineTo(0, y - 3);
                    ctx.lineTo(7, y + 4); ctx.stroke();
                }
                break;
            case 'doubleDamage':
                ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
                ctx.textBaseline = 'middle'; ctx.fillText('×2', 0, 1);
                break;
            case 'shield':
                ctx.beginPath();
                ctx.moveTo(0, -9); ctx.lineTo(8, -5); ctx.lineTo(6, 4);
                ctx.quadraticCurveTo(3, 8, 0, 10);
                ctx.quadraticCurveTo(-3, 8, -6, 4);
                ctx.lineTo(-8, -5); ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
                break;
        }
    }
}
