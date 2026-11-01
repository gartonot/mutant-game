export interface WorldView { x: number; y: number; width: number; height: number }

/** Bounds include artwork/glows; this skips drawing only, never simulation. */
export function isWorldCircleVisible(view: WorldView, x: number, y: number, radius: number): boolean {
    return x + radius >= view.x && x - radius <= view.x + view.width
        && y + radius >= view.y && y - radius <= view.y + view.height;
}
