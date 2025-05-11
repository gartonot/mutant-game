export class PlayerStatsController {
    private killCount = 0; // Кол-во убитых
    private totalShotsFired = 0;
    private totalResolvedShots = 0;
    private totalHits = 0;

    // Отрисовка статистики
    public drawStats(ctx: CanvasRenderingContext2D): void {
        const killText = `Убито врагов: ${this.killCount}`;
        const accuracyText = `Меткость: ${this.getAccuracy()}%`;

        ctx.font = '16px Arial';

        const killTextWidth = ctx.measureText(killText).width;
        const accuracyTextWidth = ctx.measureText(accuracyText).width;
        const maxWidth = Math.max(killTextWidth, accuracyTextWidth);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const x = window.innerWidth - maxWidth - 20;
        const y1 = 20;
        const y2 = y1 + 20;

        ctx.fillText(killText, x, y1);
        ctx.fillText(accuracyText, x, y2);
    }

    // Регистрируем кол-во убитых
    public registerKill(): void {
        this.killCount++;
    }

    // Получаем кол-во убитых
    public getKillCount(): number {
        return this.killCount;
    }

    // Регистрируем выстрел
    public registerShot(count: number = 1): void {
        this.totalShotsFired += count;
    }

    // Регистрируем попадание
    public registerHit(): void {
        this.totalHits++;
        this.totalResolvedShots++;
    }

    // Регистрируем промах
    public registerMiss(): void {
        this.totalResolvedShots++;
    }

    // Вычисление меткости
    public getAccuracy(): number {
        if (this.totalResolvedShots === 0) {
            return 100;
        }
        return Math.min(100, Math.round((this.totalHits / this.totalResolvedShots) * 100));
    }
}
