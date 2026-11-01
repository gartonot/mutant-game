export const ARENA_BORDER = 32;

interface ArenaSize { width: number; height: number }
interface Point { x: number; y: number }
let configuredArena: ArenaSize | undefined;
let configuredSector: ArenaSize | undefined;
let renderCamera: Point | undefined;
let arenaGeneration = 0;

function viewportSize(): ArenaSize {
    return typeof window === 'undefined'
        ? { width: 1920, height: 1080 }
        : { width: window.innerWidth, height: window.innerHeight };
}

/** Snapshot the world at the start of a run; resizing changes the camera, not the map. */
export function configureArena(width: number, height: number): void {
    arenaGeneration++;
    configuredSector = { width, height };
    configuredArena = { width: width * 3, height: height * 3 };
    renderCamera = { x: width, y: height };
}

/** Restore the viewport-sized arena used by standalone systems and tests. */
export function resetArena(expectedGeneration?: number): void {
    if (expectedGeneration !== undefined && expectedGeneration !== arenaGeneration) return;
    arenaGeneration++;
    configuredArena = undefined;
    configuredSector = undefined;
    renderCamera = undefined;
}

export function getArenaGeneration(): number { return arenaGeneration; }

export function isArenaConfigured(): boolean { return configuredArena !== undefined; }

/** Size of one original screen-sized map sector, stable throughout the run. */
export function getArenaSectorSize(): ArenaSize {
    return configuredSector ? { ...configuredSector } : getArenaSize();
}

/** Explicit dimensions retain the legacy size helper behavior. */
export function getArenaSize(width?: number, height?: number): ArenaSize {
    if (width === undefined && height === undefined && configuredArena) return { ...configuredArena };
    const viewport = viewportSize();
    return { width: width ?? viewport.width, height: height ?? viewport.height };
}

/** World coordinate of the viewport's top-left corner. No persistent camera state. */
export function getCameraPosition(player: Point, viewportWidth?: number, viewportHeight?: number): Point {
    if (!configuredArena) return { x: 0, y: 0 };
    const viewport = viewportSize();
    const width = viewportWidth ?? viewport.width, height = viewportHeight ?? viewport.height;
    const arena = getArenaSize();
    return {
        x: Math.max(0, Math.min(Math.max(0, arena.width - width), player.x - width / 2)),
        y: Math.max(0, Math.min(Math.max(0, arena.height - height), player.y - height / 2)),
    };
}

/** The followed camera is shared by rendering and screen-to-world input conversion. */
export function getRenderCameraPosition(player: Point): Point {
    if (!configuredArena) return { x: 0, y: 0 };
    const camera = renderCamera ?? getCameraPosition(player);
    const viewport = viewportSize();
    return {
        x: Math.max(0, Math.min(Math.max(0, configuredArena.width - viewport.width), camera.x)),
        y: Math.max(0, Math.min(Math.max(0, configuredArena.height - viewport.height), camera.y)),
    };
}

/** Exponential following has the same response at different simulation step sizes. */
export function updateArenaCamera(player: Point, deltaMs: number): void {
    if (!configuredArena) return;
    const camera = getRenderCameraPosition(player);
    const target = getCameraPosition(player);
    const blend = -Math.expm1(-Math.max(0, deltaMs) / 180);
    renderCamera = {
        x: camera.x + (target.x - camera.x) * blend,
        y: camera.y + (target.y - camera.y) * blend,
    };
}

/** Visible rectangle in world coordinates, clipped to the world's full bounds. */
export function getVisibleArena(player: Point): Point & ArenaSize {
    const viewport = viewportSize();
    const arena = getArenaSize();
    return {
        ...getRenderCameraPosition(player),
        width: Math.min(viewport.width, arena.width),
        height: Math.min(viewport.height, arena.height),
    };
}
