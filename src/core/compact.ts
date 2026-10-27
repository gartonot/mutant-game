/** Stable in-place removal; no replacement array per simulation tick. */
export function compact<T>(items: T[], keep: (item: T) => boolean): void {
    let write = 0;
    for (let read = 0; read < items.length; read++) {
        const item = items[read];
        if (keep(item)) items[write++] = item;
    }
    items.length = write;
}
