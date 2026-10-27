/** HUD panels overlay the world; the entire viewport remains playable. */
export function getArenaSize(width = typeof window === 'undefined' ? 1920 : window.innerWidth,
    height = typeof window === 'undefined' ? 1080 : window.innerHeight) {
    return { width, height };
}
