import { HEALTH_RADIUS, HEALTH_ARC_WIDTH } from './BottomHUDLayout';
import { drawBonusArt } from '@/rendering/BonusArt';
import type { ConsumableSlot } from '@/gameplay/ConsumableInventory';
import { DEFAULT_CONSUMABLE_SLOTS_UNLOCKED } from '@/gameplay/Consumables';

export function drawConsumableHUD(ctx: CanvasRenderingContext2D, slots: readonly ConsumableSlot[] = [],
    unlockedSlots = DEFAULT_CONSUMABLE_SLOTS_UNLOCKED, width = window.innerWidth, height = window.innerHeight): void {
    const orbit = HEALTH_RADIUS + HEALTH_ARC_WIDTH / 2 + 25;
    const radius = 20;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px Arial';
    for (let index = 0; index < 6; index++) {
        const angle = (210 + index * 24) * Math.PI / 180;
        const x = width / 2 + Math.cos(angle) * orbit;
        const y = height + Math.sin(angle) * orbit;
        const slot = slots[index];
        const locked = index >= unlockedSlots;
        const rim = ctx.createLinearGradient(x, y - radius, x, y + radius);
        rim.addColorStop(0, '#899476');
        rim.addColorStop(.45, '#48523c');
        rim.addColorStop(1, '#252e22');
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = rim; ctx.fill();
        ctx.strokeStyle = '#171f17'; ctx.lineWidth = 2; ctx.stroke();
        const well = ctx.createRadialGradient(x - 5, y - 7, 1, x, y, radius - 3);
        well.addColorStop(0, '#394333');
        well.addColorStop(1, '#151e17');
        ctx.beginPath(); ctx.arc(x, y, radius - 4, 0, Math.PI * 2);
        ctx.fillStyle = well; ctx.fill();
        ctx.strokeStyle = '#9ca38355'; ctx.lineWidth = 1; ctx.stroke();
        if (slot) {
            ctx.save();
            if (slot.used) { ctx.globalAlpha = .3; ctx.filter = 'grayscale(1)'; }
            drawBonusArt(ctx, slot.kind, x, y, 36, slot.tier);
            ctx.restore();
            if (slot.used) {
                ctx.strokeStyle = '#9ba095'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x - 9, y + 9); ctx.lineTo(x + 9, y - 9); ctx.stroke();
            }
        }
        if (locked) {
            ctx.strokeStyle = '#717769'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y - 3, 5, Math.PI, 0); ctx.stroke();
            ctx.fillStyle = '#717769'; ctx.fillRect(x - 7, y - 3, 14, 11);
        }
        const numberY = slot || locked ? y + 16 : y + 1;
        ctx.font = `bold ${slot || locked ? 11 : 15}px Arial`;
        ctx.strokeStyle = '#11180f'; ctx.lineWidth = 3;
        ctx.strokeText(String(index + 1), x, numberY);
        ctx.fillStyle = locked || slot?.used ? '#848b7c' : '#eef0dc';
        ctx.fillText(String(index + 1), x, numberY);
    }
    ctx.restore();
}
