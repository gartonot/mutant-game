export class ExplosionEffect {
    private age = 0;
    constructor(public x: number, public y: number, public radius: number, private plasma = false) {}
    get isExpired() { return this.age >= 22; }
    update() { this.age++; }
    draw(ctx: CanvasRenderingContext2D) {
        const progress = this.age / 22;
        const radius = this.radius * (.25 + .75 * progress);
        ctx.save(); ctx.globalAlpha = 1 - progress;
        const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius);
        glow.addColorStop(0, this.plasma ? '#ffffff' : '#fff2b3'); glow.addColorStop(.35, this.plasma ? '#d8fbff' : '#ffb344'); glow.addColorStop(1, this.plasma ? '#a4e9ff00' : '#b23b0600');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(this.x, this.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e6bd78'; ctx.lineWidth = 2 * (1 - progress);
        ctx.beginPath(); ctx.arc(this.x, this.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
}
