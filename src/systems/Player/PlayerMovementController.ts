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
        const speed = this.player.speed * this.player.pickupMoveSpeed * this.player.abilityMoveSpeed;
        if (this.input.isPressed(InputKey.W)) { this.player.y -= speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.S)) { this.player.y += speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.A)) { this.player.x -= speed; this.isMoving = true; }
        if (this.input.isPressed(InputKey.D)) { this.player.x += speed; this.isMoving = true; }

        constrainPlayerToArena(this.player, window.innerWidth, window.innerHeight);
    }

    public get moving(): boolean { return this.isMoving; }
}
