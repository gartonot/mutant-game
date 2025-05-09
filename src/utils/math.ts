export const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

export const distance = (x1: number, y1: number, x2: number, y2: number): number =>
    Math.hypot(x2 - x1, y2 - y1);
