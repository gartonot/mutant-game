import { HEALTH_RADIUS, HEALTH_ARC_WIDTH } from './BottomHUDLayout';

export class HealthBar {
    private maxHp: number;
    private currentHp: number;

    private animatedHp: number;
    private animatedHpTarget: number;
    private lastUpdateTime: number = 0;
    private displayedHp: number;
    private remainingMs = 360_000;

    constructor(maxHp: number) {
        this.maxHp = maxHp;
        this.currentHp = maxHp;
        this.animatedHp = maxHp;
        this.animatedHpTarget = maxHp;
        this.displayedHp = maxHp;
        this.lastUpdateTime = performance.now();
    }

    update(currentHp: number, remainingMs = this.remainingMs) {
        this.remainingMs = Math.max(0, remainingMs);
        // Medkit healing is already animated by the simulation over exactly 400 ms.
        // Follow increases directly rather than adding another easing delay.
        if (currentHp > this.currentHp) {
            this.displayedHp = currentHp;
            this.animatedHp = Math.max(this.animatedHp, currentHp);
        }
        this.currentHp = currentHp;
        this.animatedHpTarget = currentHp;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        const now = performance.now();
        const delta = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

        // Медленный хвост
        const tailSpeed = 2;
        if (this.animatedHp !== this.animatedHpTarget) {
            const deltaHp = this.animatedHpTarget - this.animatedHp;
            this.animatedHp += deltaHp * Math.min(1, tailSpeed * delta);
            if (Math.abs(this.animatedHp - this.animatedHpTarget) < 0.1) this.animatedHp = this.animatedHpTarget;
        }

        // Быстрый основной бар
        const barSpeed = 25; // Быстрее, ~0.2 сек
        if (this.displayedHp !== this.currentHp) {
            const deltaHp = this.currentHp - this.displayedHp;
            this.displayedHp += deltaHp * Math.min(1, barSpeed * delta);
            if (Math.abs(this.displayedHp - this.currentHp) < 0.1) this.displayedHp = this.currentHp;
        }

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight;

        const radius = HEALTH_RADIUS;
        const widthArc = HEALTH_ARC_WIDTH; // Толщина (ширина) дуги
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
        this.drawHealthArc(ctx, centerX, centerY, radius, widthArc - offsetWidthArc, this.animatedHp / this.maxHp, '#800000');

        // Основная дуга ХП (красная)
        this.drawHealthArc(ctx, centerX, centerY, radius, widthArc - offsetWidthArc, this.displayedHp / this.maxHp, '#d00400');

        // Текст кол-во ХП
        const textY = centerY - radius - 6;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold  18px Arial';
        ctx.fillText(`${Math.ceil(this.currentHp)}`, centerX, textY);

        // Внутренний полукруг (фон внутри дуги)
        ctx.fillStyle = '#5d6265';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - (widthArc / 2), Math.PI, 2 * Math.PI);
        ctx.fill();

        // Countdown sits inside the gauge, directly below the HP number.
        const secondsLeft = Math.ceil(this.remainingMs / 1000);
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = String(secondsLeft % 60).padStart(2, '0');
        ctx.font = 'bold 22px Arial';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#303437';
        ctx.fillStyle = 'white';
        ctx.strokeText(`${minutes}:${seconds}`, centerX, centerY - 57);
        ctx.fillText(`${minutes}:${seconds}`, centerX, centerY - 57);
        ctx.restore();
    }

    private drawHealthArc(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        radius: number,
        thickness: number,
        fraction: number,
        color: string,
    ) {
        const progress = Math.max(0, Math.min(1, fraction));
        if (progress === 0) return;

        const start = Math.PI;
        const end = start + Math.PI * progress;
        const outerRadius = radius + thickness / 2;
        const innerRadius = radius - thickness / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, start, end);

        // Fixed irregular notches create a torn edge without flicker. Taper them
        // near zero HP so the contour never extends past the start of the arc.
        if (progress < 1) {
            const notchDepths = [0, 5, 2, 9, 4, 11, 3, 7, 1, 4, 0];
            const scale = Math.min(1, progress / 0.06);
            for (let i = 1; i < notchDepths.length; i++) {
                const pointRadius = outerRadius - thickness * i / (notchDepths.length - 1);
                const angle = end - notchDepths[i] * scale / radius;
                ctx.lineTo(centerX + Math.cos(angle) * pointRadius, centerY + Math.sin(angle) * pointRadius);
            }
        } else {
            ctx.lineTo(centerX + Math.cos(end) * innerRadius, centerY + Math.sin(end) * innerRadius);
        }

        ctx.arc(centerX, centerY, innerRadius, end, start, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
}
