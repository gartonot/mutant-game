import { clamp } from '@/utils/math';

export function constrainPlayerToArena(player: { x: number; y: number; radius: number }, width: number, height: number, border = 0): void {
    // If the viewport cannot fit the body, keep its center in the remaining area.
    const insetX = Math.min(player.radius + border, width / 2);
    const insetY = Math.min(player.radius + border, height / 2);
    player.x = clamp(player.x, insetX, width - insetX);
    player.y = clamp(player.y, insetY, height - insetY);
}
