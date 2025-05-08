export interface IUpdatable {
    update: () => void;
}

export interface IDrawable {
    draw: (ctx: CanvasRenderingContext2D) => void;
}
