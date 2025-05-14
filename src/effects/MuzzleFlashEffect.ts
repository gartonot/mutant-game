export class MuzzleFlashEffect {
    private x: number;
    private y: number;
    private angle: number;
    private lifeTime: number = 100; // мс
    private createdAt: number;

    constructor(x: number, y: number, angle: number) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.createdAt = performance.now();
    }

    public update(): void {}

    public draw(ctx: CanvasRenderingContext2D): void {
        const elapsed = performance.now() - this.createdAt;
        const progress = elapsed / this.lifeTime;
        const alpha = 1 - progress;

        if (alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = alpha;

        const radius = 16;

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 100, 1)'); // яркое ядро
        gradient.addColorStop(0.4, 'rgba(255, 180, 50, 0.8)'); // тёплый слой
        gradient.addColorStop(1, 'rgba(255, 120, 0, 0)'); // мягкий переход в прозрачность

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    public get isExpired(): boolean {
        return performance.now() - this.createdAt > this.lifeTime;
    }
}
