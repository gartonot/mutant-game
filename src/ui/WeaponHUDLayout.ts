export const WEAPON_HUD_WIDTH = 460;
export const WEAPON_HUD_HEIGHT = 94;

/** Logical screen pixels are shared by canvas drawing and pointer hit testing, independent of DPR. */
export function weaponHUDLayout(width: number, height: number) {
    const available = width / 2 - 145;
    const besideHealth = available >= 300;
    const scale = Math.min(1, (besideHealth ? available : width - 16) / WEAPON_HUD_WIDTH);
    return { x: width - WEAPON_HUD_WIDTH * scale - 8,
        y: height - WEAPON_HUD_HEIGHT * scale - (besideHealth ? 8 : 190), scale };
}
export function weaponHUDTarget(x: number, y: number, width: number, height: number): { inside: boolean; slot: number | null } {
    const layout = weaponHUDLayout(width, height);
    const px = (x - layout.x) / layout.scale, py = (y - layout.y) / layout.scale;
    const inside = px >= 0 && px <= WEAPON_HUD_WIDTH && py >= 0 && py <= WEAPON_HUD_HEIGHT;
    if (inside && py >= 5 && py <= 90) {
        for (let i = 0; i < 5; i++) if (px >= 166 + i * 56 && px <= 221 + i * 56) return { inside, slot: i };
    }
    return { inside, slot: null };
}
