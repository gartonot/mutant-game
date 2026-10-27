export const HEALTH_RADIUS = 100;
export const HEALTH_ARC_WIDTH = 50;

export function bonusHUDLayout(width: number, height: number) {
    const available = width / 2 - 150;
    const besideHealth = available >= 230;
    const scale = Math.max(.1, Math.min(1, (besideHealth ? available : width - 24) / 360));
    return { y: Math.max(8, besideHealth ? height - 90 : height - 296 - 76 * scale), scale };
}
