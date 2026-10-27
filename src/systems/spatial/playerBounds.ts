import { getArenaSize } from '@/gameplay/Arena';
import { clamp } from '@/utils/math';

export function constrainPlayerToArena(player: { x: number; y: number; radius: number }, width: number, height: number): void {
    const bottom = getArenaSize(width, height).height;
    // If the viewport cannot fit the body, keep its center in the remaining area.
    const insetX = Math.min(player.radius, width / 2);
    const insetY = Math.min(player.radius, bottom / 2);
    player.x = clamp(player.x, insetX, width - insetX);
    player.y = clamp(player.y, insetY, bottom - insetY);
}
