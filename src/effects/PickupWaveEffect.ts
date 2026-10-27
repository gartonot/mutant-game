import type { BlastPickupKind } from '@/gameplay/PickupBlasts';
import type { PickupTier } from '@/gameplay/PickupVariants';

/** A simulation-clock wave centered on the collected item's ground position. */
export class PickupWaveEffect {
    private ageMs = 0;
    constructor(public readonly x: number, public readonly y: number, public readonly radius: number,
        private readonly kind: BlastPickupKind, private readonly tier: PickupTier = 'silver') {}
    private get durationMs() { return this.kind === 'iceBlast' ? 650 : 500; }
    get isExpired() { return this.ageMs >= this.durationMs; }
    update(deltaMs: number) { this.ageMs = Math.min(this.durationMs, this.ageMs + Math.max(0, deltaMs)); }
    draw(ctx: CanvasRenderingContext2D) {
        if (this.isExpired) return;
        const progress = this.ageMs / this.durationMs;
        const spread = 1 - (1 - progress) ** 2;
        const radius = Math.max(1, this.radius * spread);
        const ice = this.kind === 'iceBlast';
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = (1 - progress) * .85;
        const glow = ctx.createRadialGradient(0, 0, radius * .45, 0, 0, radius);
        glow.addColorStop(0, ice ? '#46cfff00' : '#ff620000');
        glow.addColorStop(.8, ice ? '#48cfff32' : '#ff6b0050');
        glow.addColorStop(.95, ice ? '#b7faff99' : '#ffd168aa');
        glow.addColorStop(1, ice ? '#46cfff00' : '#ff620000');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ice ? '#c7fbff' : '#ffda79';
        ctx.lineWidth = (ice ? 3 : 5) * (1 - progress) + 1;
        ctx.shadowColor = ice ? '#3ccfff' : '#ff6b13'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, 0, radius * .95, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = this.tier === 'gold' ? '#ffdf78' : ice ? '#5fcfee' : '#f87028';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, radius * .78, 0, Math.PI * 2); ctx.stroke();
        // Short shards or radial embers follow the shock front without hiding enemies.
        for (let i = 0; i < 18; i++) {
            const angle = i * Math.PI * 2 / 18 + .12;
            const length = (ice ? 17 : 24) * (1 - progress);
            ctx.save(); ctx.rotate(angle); ctx.translate(radius * (.8 + .12 * (i % 3) / 2), 0);
            ctx.fillStyle = ice ? '#bcefff' : '#ffbb55';
            ctx.beginPath(); ctx.moveTo(length, 0); ctx.lineTo(0, ice ? -3 : -2);
            ctx.lineTo(-length * .4, 0); ctx.lineTo(0, ice ? 3 : 2); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
}
