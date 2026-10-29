import { InputKey } from '@/constants/InputKey';
import { Player } from '@/entities/player/Player';
import { InputSystem } from '@/systems/InputSystem';
import { constrainPlayerToArena } from '@/systems/spatial/playerBounds';

export class PlayerMovementController {
    private player: Player;
    private input: InputSystem;
    private isMoving = false;

    constructor(player: Player, input: InputSystem) {
        this.player = player;
        this.input = input;
    }

    public update(): void {
        this.handleMovement();
    }

    private handleMovement(): void {
        this.isMoving = false;
        const speed = this.player.speed * this.player.pickupMoveSpeed * this.player.abilityMoveSpeed * this.player.enemyMoveFactor;
        if (speed === 0) return;
        const dx = Number(this.input.isPressed(InputKey.D)) - Number(this.input.isPressed(InputKey.A));
        const dy = Number(this.input.isPressed(InputKey.S)) - Number(this.input.isPressed(InputKey.W));
        // Keep diagonal travel exactly 50% faster than cardinal movement.
        const step = speed * (dx !== 0 && dy !== 0 ? 1.5 / Math.SQRT2 : 1);
        this.player.x += dx * step;
        this.player.y += dy * step;
        this.isMoving = dx !== 0 || dy !== 0;

        constrainPlayerToArena(this.player, window.innerWidth, window.innerHeight);
    }

    public get moving(): boolean { return this.isMoving; }
}
