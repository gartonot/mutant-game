/** Shared browser image lifecycle. Failure settles readiness so Canvas fallbacks stay usable. */
export type ImageAsset = {
    readonly image: HTMLImageElement;
    readonly loaded: boolean;
    readonly ready: Promise<boolean>;
};

export function loadImageAsset(url: string, createImage = () => new Image()): ImageAsset {
    const image = createImage();
    let loaded = false;
    const ready = new Promise<boolean>(resolve => {
        const settle = (success: boolean) => {
            loaded = success;
            image.onload = null;
            image.onerror = null;
            resolve(success);
        };
        image.onload = () => settle(true);
        image.onerror = () => settle(false);
        image.src = url;
    });
    return { image, get loaded() { return loaded; }, ready };
}
