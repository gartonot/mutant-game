/** Shared browser image lifecycle. Failure settles readiness so Canvas fallbacks stay usable. */
export type ImageAsset = {
    readonly image: HTMLImageElement;
    readonly loaded: boolean;
    readonly ready: Promise<boolean>;
};

export function loadImageAsset(url: string, createImage = () => new Image(), timeoutMs = 15_000): ImageAsset {
    const image = createImage();
    let loaded = false;
    const ready = new Promise<boolean>(resolve => {
        let settled = false;
        const settle = (success: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            loaded = success;
            image.onload = null;
            image.onerror = null;
            resolve(success);
        };
        const timeout = setTimeout(() => settle(false), timeoutMs);
        image.onload = () => {
            // Resolve only after pixels are ready to paint, including cached images.
            if (typeof image.decode === 'function') {
                void image.decode().then(() => settle(true), () => settle(false));
            } else settle(true);
        };
        image.onerror = () => settle(false);
        image.src = url;
    });
    return { image, get loaded() { return loaded; }, ready };
}

/** URL registration is inert. Explicit preparation shares work and retries failed attempts. */
export function createLazyImageAsset(url: string, createImage = () => new Image()) {
    let asset: ImageAsset | undefined;
    let pending: Promise<boolean> | undefined;
    return {
        get asset() { return asset; },
        ensure(): Promise<boolean> {
            if (pending) return pending;
            asset = loadImageAsset(url, createImage);
            pending = asset.ready.then(success => {
                if (!success) pending = undefined;
                return success;
            });
            return pending;
        },
    };
}
