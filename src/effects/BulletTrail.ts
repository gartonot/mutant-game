export class BulletTrail {
    private history: { x: number; y: number }[] = [];
    private readonly maxLength = 102;

    constructor(initialX: number, initialY: number) {
        this.history.push({ x: initialX, y: initialY });
    }

    public update(x: number, y: number): void {
        const last = this.history[this.history.length - 1];
        const dx = x - last.x;
        const dy = y - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const segmentCount = Math.floor(distance / 2); // интерполяция с шагом ~2px
        for (let i = 1; i <= segmentCount; i++) {
            const t = i / (segmentCount + 1);
            const ix = last.x + dx * t;
            const iy = last.y + dy * t;
            this.history.push({ x: ix, y: iy });
        }

        this.history.push({ x, y });

        if (this.history.length > this.maxLength) {
            this.history.splice(0, this.history.length - this.maxLength);
        }
    }

    public draw(ctx: CanvasRenderingContext2D): void {
        if (this.history.length < 2) return;

        ctx.save();
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        for (let i = 1; i < this.history.length; i++) {
            const prev = this.history[i - 1];
            const curr = this.history[i];
            const alpha = i / this.history.length;

            ctx.strokeStyle = `rgba(255, 255, 150, ${alpha * 0.4})`;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }

        ctx.restore();
    }
}
