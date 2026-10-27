import { HealthBar } from '@/ui/HealthBar';
import type { Player } from '@entities/player/Player.ts';

export class UIRenderer {
    private player: Player;
    private healthBar: HealthBar;


    constructor(player: Player) {
        this.player = player;
        this.healthBar = new HealthBar(this.player.maxHp);
    }

    update(remainingMs: number) {
        this.healthBar.update(this.player.currentHp, remainingMs);
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.healthBar.draw(ctx);
    }
}
