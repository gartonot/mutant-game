export class HealthBar {
    private maxHp: number;
    private currentHp: number;

    constructor(maxHp: number) {
        this.maxHp = maxHp;
        this.currentHp = maxHp;
    }

    update(currentHp: number) {
        this.currentHp = currentHp;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight;

        const radius = 80;
        const widthArc = 40; // Толщина (ширина) дуги
        const offsetWidthArc = 10; // Толщина обводки для дуги (должна быть меньше ширины)

        const startAngle = Math.PI;
        const endAngle = 2 * Math.PI;
        const hpPercent = this.currentHp / this.maxHp;
        const filledEndAngle = startAngle + Math.PI * hpPercent;

        // Фон дуги
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = 'silver';
        ctx.lineWidth = widthArc;
        ctx.stroke();

        // Заполненная часть дуги
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, filledEndAngle);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = widthArc - offsetWidthArc;
        ctx.stroke();

        // Текущий HP в центре
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '16px Arial';
        ctx.fillText(`${this.currentHp}`, centerX, centerY - 77);
    }
}
