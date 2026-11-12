import { HEALTH_RADIUS, HEALTH_ARC_WIDTH } from './BottomHUDLayout';

export class HealthBar {
    private maxHp: number;
    private currentHp: number;

    private animatedHp: number;
    private displayedHp: number;
    private remainingMs = 360_000;
    private lastHealingReceived = 0;
    private healingOpacity = 0;

    constructor(maxHp: number) {
        this.maxHp = maxHp;
        this.currentHp = maxHp;
        this.animatedHp = maxHp;
        this.displayedHp = maxHp;
    }

    update(currentHp: number, remainingMs: number, healingReceived: number) {
        const dt = Math.max(0, this.remainingMs - Math.max(0, remainingMs));
        const healing = healingReceived > this.lastHealingReceived;
        this.lastHealingReceived = healingReceived;
        this.remainingMs = Math.max(0, remainingMs);
        this.healingOpacity = currentHp <= 0 ? 0 : healing
            ? Math.min(1, this.healingOpacity + dt / 100)
            : Math.max(0, this.healingOpacity - dt / 180);
        // Follow the actual healing edge even if a hit outweighed this tick's gain.
        if (currentHp === 0 || healing || currentHp >= this.displayedHp) this.displayedHp = currentHp;
        else this.displayedHp += (currentHp - this.displayedHp) * Math.min(1, dt / 40);
        this.animatedHp = Math.max(currentHp, this.animatedHp + (currentHp - this.animatedHp) * Math.min(1, dt / 500));
        if (Math.abs(this.displayedHp - currentHp) < .1) this.displayedHp = currentHp;
        if (Math.abs(this.animatedHp - currentHp) < .1) this.animatedHp = currentHp;
        this.currentHp = currentHp;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
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
        if (this.healingOpacity > 0) {
            const fraction = this.displayedHp / this.maxHp;
            const from = Math.max(0, fraction - .095);
            const start = Math.PI * (1 + from), end = Math.PI * (1 + fraction);
            const glow = ctx.createLinearGradient(centerX + radius * Math.cos(start), centerY + radius * Math.sin(start),
                centerX + radius * Math.cos(end), centerY + radius * Math.sin(end));
            glow.addColorStop(0, 'rgba(255, 155, 0, 0)');
            glow.addColorStop(.55, '#ffac12');
            glow.addColorStop(1, '#fff287');
            ctx.save();
            ctx.globalAlpha *= this.healingOpacity;
            this.drawHealthArc(ctx, centerX, centerY, radius, widthArc - offsetWidthArc, fraction, glow, from);
            ctx.restore();
        }

        // Текст кол-во ХП
        const textY = centerY - radius - 6;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold  18px Arial';
        // Fractional healing can leave a whole HP a few floating-point units above its integer.
        const hpNumber = this.currentHp > 0 ? Math.max(1, Math.ceil(this.currentHp - 1e-8)) : 0;
        ctx.fillText(String(hpNumber), centerX, textY);

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
        color: string | CanvasGradient,
        from = 0,
    ) {
        const progress = Math.max(0, Math.min(1, fraction));
        if (progress === 0) return;

        const start = Math.PI * (1 + from);
        const end = Math.PI * (1 + progress);
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
