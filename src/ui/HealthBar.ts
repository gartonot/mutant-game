export class HealthBar {
    private maxHp: number;
    private currentHp: number;

    private animatedHp: number;
    private animatedHpTarget: number;
    private lastUpdateTime: number = 0;
    private displayedHp: number;

    constructor(maxHp: number) {
        this.maxHp = maxHp;
        this.currentHp = maxHp;
        this.animatedHp = maxHp;
        this.animatedHpTarget = maxHp;
        this.displayedHp = maxHp;
        this.lastUpdateTime = performance.now();
    }

    update(currentHp: number) {
        this.currentHp = currentHp;
        this.animatedHpTarget = currentHp;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const now = performance.now();
        const delta = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

        // Медленный хвост
        const tailSpeed = 2;
        if (this.animatedHp !== this.animatedHpTarget) {
            const deltaHp = this.animatedHpTarget - this.animatedHp;
            this.animatedHp += deltaHp * tailSpeed * delta;
            if (Math.abs(this.animatedHp - this.animatedHpTarget) < 0.1) this.animatedHp = this.animatedHpTarget;
        }

        // Быстрый основной бар
        const barSpeed = 25; // Быстрее, ~0.2 сек
        if (this.displayedHp !== this.currentHp) {
            const deltaHp = this.currentHp - this.displayedHp;
            this.displayedHp += deltaHp * barSpeed * delta;
            if (Math.abs(this.displayedHp - this.currentHp) < 0.1) this.displayedHp = this.currentHp;
        }

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight;

        const radius = 100;
        const widthArc = (radius / 2); // Толщина (ширина) дуги
        const offsetWidthArc = 10; // Толщина обводки для дуги (должна быть меньше ширины)

        const startAngle = Math.PI;
        const endAngle = 2 * Math.PI;

        // Фон дуги
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = '#bfbfbf';
        ctx.lineWidth = widthArc;
        ctx.stroke();

        // Фон подложка под ХП
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, 2 * Math.PI);
        ctx.strokeStyle = '#403938';
        ctx.lineWidth = widthArc - offsetWidthArc;
        ctx.stroke();

        // Темная дуга "фитиль ХП"
        ctx.strokeStyle = '#800000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + Math.PI * (this.animatedHp / this.maxHp));
        ctx.stroke();

        // Основная дуга ХП (красная)
        ctx.strokeStyle = '#d00400';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + Math.PI * (this.displayedHp / this.maxHp));
        ctx.stroke();

        // Текст кол-во ХП
        const textY = centerY - radius - 6;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold  18px Arial';
        ctx.fillText(`${this.currentHp}`, centerX, textY);

        // Внутренний полукруг (фон внутри дуги)
        ctx.fillStyle = '#5d6265';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - (widthArc / 2), Math.PI, 2 * Math.PI);
        ctx.fill();
    }
}
