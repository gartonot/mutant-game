import { InputKey } from '@/constants/InputKey';
import { Player } from '@/entities/player/Player';
import { InputSystem } from '@/systems/InputSystem';
import { clamp } from '@/utils/math';

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

        if (this.input.isPressed(InputKey.W)) { this.player.y -= this.player.speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.S)) { this.player.y += this.player.speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.A)) { this.player.x -= this.player.speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.D)) { this.player.x += this.player.speed; this.isMoving = true; }

        const playerRadius = this.player.radius;
        this.player.x = clamp(this.player.x, playerRadius, window.innerWidth - playerRadius);
        this.player.y = clamp(this.player.y, playerRadius, window.innerHeight - playerRadius);
    }

    public get moving(): boolean { return this.isMoving; }
}
