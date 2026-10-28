import type { AbilityState } from '@/gameplay/CharacterAbilities';
import { bonusHUDLayout } from './BottomHUDLayout';
import { drawAbilityIcon } from '@/rendering/AbilityIcons';

/** Ability time is simulation time: the display freezes together with the fight. */
export function drawAbilityHUD(ctx: CanvasRenderingContext2D, state: AbilityState | null,
    width = window.innerWidth, height = window.innerHeight): void {
    const orb = bonusHUDLayout(width, height);
    const active = (state?.remainingActiveMs ?? 0) > 0;
    const ready = !!state && state.remainingCooldownMs <= 0;
    const color = active ? '#ffe58b' : ready ? '#c5ed9b' : '#a2aa98';
    const progress = state ? ready ? 1 : Math.max(0, Math.min(1, 1 - state.remainingCooldownMs / state.cooldownMs)) : 0;
    // Connect the existing F orb to the same state as the readable status panel.
    ctx.save(); ctx.translate(12, orb.y); ctx.scale(orb.scale, orb.scale); ctx.translate(43, 39);
    if (state) drawAbilityIcon(ctx, state.character, -24, -24, 48, 24);
    if (!ready && !active) {
        ctx.fillStyle = '#101a1dc9'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px Arial';
    ctx.strokeStyle = '#17221e'; ctx.lineWidth = 4; ctx.fillStyle = color;
    const seconds = state ? Math.ceil((active ? state.remainingActiveMs : state.remainingCooldownMs) / 1000) : 0;
    const text = !state ? '—' : ready ? 'F' : String(seconds);
    ctx.strokeText(text, 0, 1); ctx.fillText(text, 0, 1); ctx.restore();
    if (!state) return;
    const boxWidth = Math.min(244, width - 24), x = width - boxWidth - 12, y = 88;
    const label = active ? `Действует · ${Math.ceil(state.remainingActiveMs / 1000)} с`
        : ready ? 'Готово' : `Перезарядка · ${Math.ceil(state.remainingCooldownMs / 1000)} с`;
    ctx.save();
    ctx.fillStyle = 'rgba(17, 27, 19, .9)';
    ctx.strokeStyle = active || ready ? color : '#55634b';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, boxWidth, 76, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = active ? '#6b592b' : '#34432c';
    ctx.beginPath(); ctx.roundRect(x + 9, y + 9, 48, 48, 6); ctx.fill();
    drawAbilityIcon(ctx, state.character, x + 9, y + 9, 48);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x + 9, y + 9, 48, 48, 6); ctx.stroke();
    ctx.fillStyle = '#101a17';
    ctx.beginPath(); ctx.roundRect(x + 42, y + 43, 18, 18, 4); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Arial'; ctx.fillText('F', x + 51, y + 52);
    ctx.textAlign = 'left'; ctx.font = 'bold 14px Arial';
    ctx.fillText(state.name, x + 68, y + 23, boxWidth - 78);
    ctx.font = '12px Arial'; ctx.fillStyle = color;
    ctx.fillText(label, x + 68, y + 43, boxWidth - 78);
    ctx.fillStyle = '#34412c'; ctx.fillRect(x + 10, y + 66, boxWidth - 20, 3);
    ctx.fillStyle = color; ctx.fillRect(x + 10, y + 66, (boxWidth - 20) * progress, 3);
    ctx.restore();
}
