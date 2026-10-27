/** Fixed-capacity ring: no point objects, splice, or one stroke per tiny segment. */
export class BulletTrail {
    private readonly capacity = 102;
    private points = new Float64Array(this.capacity * 2);
    private head = 0;
    private count = 0;
    private lastX: number;
    private lastY: number;
    constructor(x: number, y: number) {
        this.lastX = x; this.lastY = y;
        this.append(x, y);
    }
    private append(x: number, y: number): void {
        const index = this.head * 2;
        this.points[index] = x; this.points[index + 1] = y;
        this.head = (this.head + 1) % this.capacity;
        this.count = Math.min(this.count + 1, this.capacity);
    }
    update(x: number, y: number): void {
        const dx = x - this.lastX, dy = y - this.lastY;
        const segments = Math.min(this.capacity, Math.floor(Math.hypot(dx, dy) / 2));
        for (let i = 1; i <= segments; i++) {
            const t = i / (segments + 1);
            this.append(this.lastX + dx * t, this.lastY + dy * t);
        }
        this.append(x, y); this.lastX = x; this.lastY = y;
    }
    draw(ctx: CanvasRenderingContext2D): void {
        if (this.count < 2) return;
        const start = (this.head - this.count + this.capacity) % this.capacity;
        const x = this.points[start * 2], y = this.points[start * 2 + 1];
        if (x === this.lastX && y === this.lastY) return;
        ctx.save();
        const fade = ctx.createLinearGradient(x, y, this.lastX, this.lastY);
        fade.addColorStop(0, 'rgba(255,255,150,0)'); fade.addColorStop(1, 'rgba(255,255,150,0.4)');
        ctx.strokeStyle = fade; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 1; i < this.count; i++) {
            const index = ((start + i) % this.capacity) * 2;
            ctx.lineTo(this.points[index], this.points[index + 1]);
        }
        ctx.stroke(); ctx.restore();
    }
}
