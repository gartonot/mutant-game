export class PlayerStatsController {
    private killCount = 0; // Кол-во убитых
    private totalShotsFired = 0;
    private totalResolvedShots = 0;
    private totalHits = 0;

    // Отрисовка статистики
    public drawStats(ctx: CanvasRenderingContext2D): void {
        const killText = `Убито ${this.killCount}`;
        const accuracyText = `Меткость ${this.getAccuracy()}%`;

        ctx.font = 'bold 16px Arial';
        const paddingY = 8;
        const lineHeight = 20;

        // Фиксированная ширина подложки для удлинения
        const boxWidth = 200;
        const boxHeight = lineHeight * 2 + paddingY * 2;

        const x = window.innerWidth - boxWidth; // Прижать к правому краю без отступов
        const y = 20;

        // Градиентная подложка от правого края влево
        const gradient = ctx.createLinearGradient(window.innerWidth, 0, x, 0);
        gradient.addColorStop(0, 'rgba(204, 200, 44, 0.4)');
        gradient.addColorStop(1, 'rgba(204, 200, 44, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, boxWidth, boxHeight);

        // Текст
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(killText, window.innerWidth - 10, y + paddingY);
        ctx.fillText(accuracyText, window.innerWidth - 10, y + paddingY + lineHeight);
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
