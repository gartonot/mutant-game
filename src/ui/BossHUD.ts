import type { BossHUDState } from '@/gameplay/BossEncounter';

/** Metal-framed boss bar slides into view during the two-second arrival. */
export function drawBossHUD(ctx: CanvasRenderingContext2D, state: BossHUDState | null, width: number): void {
    if (!state) return;
    const w = Math.min(370, Math.max(180, width - 32));
    // Encounter age starts at spawn, so the bar arrives while the boss enters.
    // Smoothstep eases both ends instead of stopping a linear slide abruptly.
    const progress = Math.max(0, Math.min(1, state.ageMs / 1200));
    const eased = progress * progress * (3 - 2 * progress);
    const x = (width - w) / 2, y = -60 + 80 * eased;
    const ratio = Math.max(0, Math.min(1, state.health / state.maxHealth));
    ctx.save();
    const metal = ctx.createLinearGradient(0, y, 0, y + 48);
    metal.addColorStop(0, '#e0e1d6'); metal.addColorStop(.3, '#777e76'); metal.addColorStop(.7, '#303b36'); metal.addColorStop(1, '#a5aaa0');
    ctx.fillStyle = '#121713'; ctx.fillRect(x - 2, y - 2, w + 4, 50);
    ctx.fillStyle = metal; ctx.fillRect(x, y, w, 46);
    ctx.fillStyle = '#242824'; ctx.fillRect(x + 12, y + 10, w - 24, 26);
    const health = ctx.createLinearGradient(0, y + 10, 0, y + 36);
    health.addColorStop(0, '#fb3d23'); health.addColorStop(1, '#a80808');
    ctx.fillStyle = health; ctx.fillRect(x + 12, y + 10, (w - 24) * ratio, 26);
    ctx.strokeStyle = '#0e140f'; ctx.lineWidth = 2; ctx.strokeRect(x + 12, y + 10, w - 24, 26);
    ctx.font = 'bold 17px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#172018'; ctx.lineWidth = 3; ctx.fillStyle = '#f4f1dd';
    ctx.strokeText(state.name, width / 2, y + 24); ctx.fillText(state.name, width / 2, y + 24);
    ctx.restore();
}
