import type { PickupKind } from '@/gameplay/Pickups';
import { bonusHUDLayout } from './BottomHUDLayout';
import { drawBonusArt } from '@/rendering/BonusArt';
import type { PickupTier } from '@/gameplay/PickupVariants';

type BonusKind = 'shield' | 'rapidFire' | 'moveSpeed' | 'doubleDamage';
type BonusProgress = Readonly<Record<BonusKind, number>>;

const TAU = Math.PI * 2;
const COLORS: Record<BonusKind, string> = {
    shield: '#ffe85a', rapidFire: '#c9ee48', moveSpeed: '#72eaff', doubleDamage: '#ffb52c',
};
const PICKUP_LABELS: Record<PickupKind, string> = {
    ammo: 'Патроны', weapon: 'Оружие', health: 'Аптечка', shield: 'Щит',
    rapidFire: 'Скорострельность ×2', moveSpeed: 'Скорость бега ×1,5', doubleDamage: 'Двойной урон',
    iceBlast: 'Ледяной взрыв', fireBlast: 'Взрыв',
};
const GOLD_PICKUP_LABELS: Record<PickupKind, string> = {
    ammo: 'Патроны', weapon: 'Оружие', health: 'Золотая аптечка +100 HP', shield: 'Золотой щит',
    rapidFire: 'Скорострельность ×4', moveSpeed: 'Скорость бега ×3', doubleDamage: 'Урон ×4',
    iceBlast: 'Золотой ледяной взрыв', fireBlast: 'Золотой взрыв',
};

function circle(ctx: CanvasRenderingContext2D, radius: number, fill: string | CanvasGradient) {
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}

function drawSymbol(ctx: CanvasRenderingContext2D, kind: BonusKind) {
    ctx.fillStyle = COLORS[kind];
    ctx.strokeStyle = COLORS[kind];
    ctx.lineJoin = 'round';
    if (kind === 'shield') {
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(14, -10); ctx.lineTo(12, 3);
        ctx.quadraticCurveTo(9, 12, 0, 17); ctx.quadraticCurveTo(-9, 12, -12, 3);
        ctx.lineTo(-14, -10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b68b23'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, -7);
        ctx.lineTo(7, 3); ctx.quadraticCurveTo(5, 8, 0, 11); ctx.closePath(); ctx.fill();
    } else if (kind === 'rapidFire') {
        ctx.save(); ctx.rotate(-.18);
        for (const x of [-11, 10]) {
            ctx.fillStyle = '#91b62f'; ctx.beginPath(); ctx.roundRect(x - 2, -6, 4, 19, 2); ctx.fill();
        }
        ctx.fillStyle = COLORS[kind]; ctx.beginPath(); ctx.moveTo(3, -19); ctx.lineTo(-10, 2);
        ctx.lineTo(-1, 2); ctx.lineTo(-4, 18); ctx.lineTo(12, -5); ctx.lineTo(3, -5); ctx.closePath(); ctx.fill();
        ctx.restore();
    } else if (kind === 'moveSpeed') {
        ctx.lineWidth = 5;
        for (const y of [-4, 9]) {
            ctx.beginPath(); ctx.moveTo(-13, y + 6); ctx.lineTo(0, y - 8); ctx.lineTo(13, y + 6); ctx.stroke();
        }
    } else {
        const glow = ctx.createRadialGradient(-4, -5, 1, 0, 0, 18);
        glow.addColorStop(0, '#ffff92'); glow.addColorStop(.38, '#ffe21f');
        glow.addColorStop(.72, '#ffaf0b'); glow.addColorStop(1, '#e46313');
        circle(ctx, 17, glow);
        ctx.lineWidth = 2; ctx.strokeStyle = '#ffd341'; ctx.beginPath(); ctx.arc(0, 0, 20, .2, 2.5); ctx.stroke();
    }
}

function drawDial(ctx: CanvasRenderingContext2D, kind: BonusKind, progress: number, tier: PickupTier) {
    if (drawBonusArt(ctx, kind, 0, 0, 60, tier)) {
        // Keep the generated metal rim visible while the face counts down like a clock.
        if (progress > 0 && progress < 1) {
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, 23, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - progress));
            ctx.closePath(); ctx.fillStyle = '#08131bc4'; ctx.fill();
        }
        return;
    }
    const active = progress > 0;
    const metal = ctx.createLinearGradient(0, -29, 0, 29);
    metal.addColorStop(0, tier === 'gold' ? '#fff1a4' : '#d1d7c0');
    metal.addColorStop(.35, tier === 'gold' ? '#e4ae35' : '#72806d');
    metal.addColorStop(1, tier === 'gold' ? '#8c5919' : '#303e36');
    circle(ctx, 30, '#263b2d'); circle(ctx, 27.5, metal); circle(ctx, 24, '#263d25');
    ctx.save(); ctx.globalAlpha *= active ? 1 : .42;
    const field = ctx.createRadialGradient(-7, -12, 0, 0, 0, 23);
    field.addColorStop(0, kind === 'moveSpeed' ? '#327b93' : '#647d38'); field.addColorStop(1, '#182d22');
    circle(ctx, 22.5, field);
    drawSymbol(ctx, kind);
    // Elapsed time sweeps clockwise from twelve, leaving the remaining portion bright.
    if (active && progress < 1) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 23, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - progress));
        ctx.closePath(); ctx.fillStyle = '#08131bc4'; ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = active ? '#668642' : '#4b6140';
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
    if (active) {
        ctx.strokeStyle = COLORS[kind]; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 24, -Math.PI / 2 + TAU * (1 - progress), Math.PI * 1.5); ctx.stroke();
    }
}

interface AnimatedBonus {
    from: number;
    target: number;
    elapsed: number;
    entering: boolean;
    lifted: boolean;
}

const SHUFFLE_MS = 450;
function easing(elapsed: number): number {
    const t = Math.max(0, Math.min(1, elapsed / SHUFFLE_MS));
    return t * t * (3 - 2 * t);
}
function position(item: AnimatedBonus): number {
    return item.from + (item.target - item.from) * easing(item.elapsed);
}

/** One instance per run: positions and fades advance only with simulation time. */
export class BonusHUD {
    private readonly items = new Map<BonusKind, AnimatedBonus>();
    private progress: BonusProgress = { shield: 0, rapidFire: 0, moveSpeed: 0, doubleDamage: 0 };
    private order: BonusKind[] = [];
    private panelWidth = 86;
    private tiers: Readonly<Partial<Record<BonusKind, PickupTier>>> = {};
    private notices: { kind: PickupKind; tier: PickupTier; elapsed: number; label?: string; activated?: boolean }[] = [];

    notifyEquipment(text: string, kind: 'ammo' | 'weapon'): void {
        this.notices.push({ kind, tier: 'silver', elapsed: 0, label: text });
        if (this.notices.length > 3) this.notices.shift();
    }

    notifyPickup(kind: PickupKind, tier: PickupTier = 'silver', activated = false): void {
        this.notices.push({ kind, tier, elapsed: 0, activated });
        // A short stack keeps simultaneous drops readable without covering the arena.
        if (this.notices.length > 3) this.notices.shift();
    }

    update(deltaMs: number, progress: BonusProgress, order: readonly BonusKind[], tiers: Readonly<Partial<Record<BonusKind, PickupTier>>> = {}): void {
        const dt = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
        for (const notice of this.notices) notice.elapsed += dt;
        this.notices = this.notices.filter(notice => notice.elapsed < 2600);
        for (const item of this.items.values()) item.elapsed = Math.min(SHUFFLE_MS, item.elapsed + dt);
        const next = [...new Set(order)].filter(kind => Number.isFinite(progress[kind]) && progress[kind] > 0);
        for (const kind of this.items.keys()) if (!next.includes(kind)) this.items.delete(kind);
        next.forEach((kind, index) => {
            const target = 119 + index * 66;
            const item = this.items.get(kind);
            if (!item) {
                this.items.set(kind, { from: target + 18, target, elapsed: 0, entering: true, lifted: false });
            } else if (item.target !== target) {
                const current = position(item);
                item.lifted = target > item.target;
                item.from = current;
                item.target = target;
                item.elapsed = 0;
                item.entering = false;
            } else if (progress[kind] > this.progress[kind] + .001) {
                // Refreshing the newest bonus still gives a subtle pickup bounce.
                item.from = position(item); item.elapsed = 0; item.entering = false; item.lifted = true;
            }
        });
        this.order = next;
        this.progress = { ...progress };
        this.tiers = { ...tiers };
        const targetWidth = next.length === 0 ? 86 : 96 + next.length * 66;
        this.panelWidth += (targetWidth - this.panelWidth) * (1 - Math.exp(-dt / 110));
        if (Math.abs(targetWidth - this.panelWidth) < .1) this.panelWidth = targetWidth;
    }

    draw(ctx: CanvasRenderingContext2D, width = window.innerWidth, height = window.innerHeight): void {
    const { y, scale } = bonusHUDLayout(width, height);
    ctx.save(); ctx.translate(12, y); ctx.scale(scale, scale);
    this.drawNotices(ctx);
    const metal = ctx.createLinearGradient(0, 0, 0, 76);
    metal.addColorStop(0, '#647b83'); metal.addColorStop(.15, '#c5cecc');
    metal.addColorStop(.4, '#a8b2b2'); metal.addColorStop(.65, '#697b7c'); metal.addColorStop(1, '#3c535a');
    ctx.shadowColor = '#09171d88'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.roundRect(0, 0, this.panelWidth, 76, [8, 36, 12, 8]);
    ctx.fillStyle = metal; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#263f47'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.clip();
    const green = ctx.createLinearGradient(0, 0, 70, 76);
    green.addColorStop(0, '#92d52a'); green.addColorStop(.5, '#4b9810'); green.addColorStop(1, '#245908');
    ctx.fillStyle = green; ctx.beginPath(); ctx.roundRect(0, 0, 84, 85, [0, 42, 0, 0]); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#e1ecea55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(3, 3, this.panelWidth - 6, 70, [6, 33, 9, 6]); ctx.stroke();

    ctx.save(); ctx.translate(43, 39);
    circle(ctx, 31, '#23441c'); circle(ctx, 28, '#bed84a'); circle(ctx, 25, '#4d6d35');
    const pearl = ctx.createRadialGradient(-6, -8, 1, 0, 0, 23);
    pearl.addColorStop(0, '#f5ffff'); pearl.addColorStop(.24, '#d5edf6');
    pearl.addColorStop(.48, '#87acc6'); pearl.addColorStop(.7, '#526d9b'); pearl.addColorStop(1, '#243b67');
    circle(ctx, 22.5, pearl); ctx.restore();
    ctx.font = 'bold 16px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = '#305624'; ctx.strokeText('F', 8, 8);
    ctx.fillStyle = '#fffdeb'; ctx.fillText('F', 8, 8);
    // Draw the refreshed icon last so its small upward arc passes over sliding neighbours.
    const drawOrder = [...this.order].sort((a, b) => Number(this.items.get(a)!.lifted) - Number(this.items.get(b)!.lifted));
    drawOrder.forEach(kind => {
        const item = this.items.get(kind)!;
        const value = this.progress[kind];
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
        const t = Math.min(1, item.elapsed / SHUFFLE_MS);
        const lift = item.lifted ? Math.sin(t * Math.PI) * 15 : 0;
        ctx.save(); ctx.translate(position(item), 40 - lift);
        ctx.globalAlpha = item.entering ? easing(item.elapsed) : 1;
        drawDial(ctx, kind, normalized, this.tiers[kind] ?? 'silver'); ctx.restore();
    });
    ctx.restore();
    }

    private drawNotices(ctx: CanvasRenderingContext2D): void {
        this.notices.forEach((notice, index) => {
            const enter = Math.min(1, notice.elapsed / 280);
            const exit = Math.max(0, (notice.elapsed - 2100) / 500);
            const slide = 1 - (1 - enter) ** 3;
            const color = notice.tier === 'gold' ? '#ffdc73' : notice.kind === 'health' ? '#ff8171'
                : notice.kind === 'ammo' ? '#ffd36c' : notice.kind === 'weapon' ? '#99e6ff' : notice.kind === 'iceBlast' ? '#75eaff'
                    : notice.kind === 'fireBlast' ? '#ff963d' : COLORS[notice.kind];
            ctx.save();
            ctx.translate(-32 * (1 - slide) - 12 * exit, -60 - (this.notices.length - 1 - index) * 54);
            ctx.globalAlpha *= enter * (1 - exit);
            ctx.font = 'bold 17px Arial';
            const label = notice.label ?? (notice.tier === 'gold' ? GOLD_PICKUP_LABELS : PICKUP_LABELS)[notice.kind];
            const width = Math.max(160, ctx.measureText(label).width + 30);
            const background = ctx.createLinearGradient(0, 0, width, 0);
            background.addColorStop(0, '#0b181de8'); background.addColorStop(1, '#0b181d80');
            ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(0, 0, width, 46, 6); ctx.fill();
            ctx.fillStyle = color; ctx.fillRect(0, 7, 3, 32);
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.font = 'bold 10px Arial'; ctx.fillStyle = '#c5d1ca'; ctx.fillText(notice.activated ? 'АКТИВИРОВАНО' : 'ПОДОБРАНО', 12, 7);
            ctx.font = 'bold 17px Arial'; ctx.fillStyle = color; ctx.fillText(label, 12, 22);
            ctx.restore();
        });
    }
}
