import { renderBloodDecal } from './BloodDecal';
import type { BloodDecalInput } from './BloodDecal';
import { renderRemainsAtlas } from './BloodRemains';
import type { PreparedBloodDecal } from './BloodDecalWorkerPool';

const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<{ id: number; input: BloodDecalInput }>) => void) | null;
    postMessage: (message: unknown, transfer: Transferable[]) => void;
};

scope.onmessage = event => {
    const { id, input } = event.data;
    let bitmap: ImageBitmap | null = null;
    let remainsBitmap: ImageBitmap | null = null;
    try {
        const canvas = new OffscreenCanvas(1, 1);
        const result = renderBloodDecal(input, canvas);
        if (!result) {
            scope.postMessage({ id, result: null }, []);
            return;
        }
        bitmap = canvas.transferToImageBitmap();
        const prepared: PreparedBloodDecal = { canvas: bitmap, x: result.x, y: result.y };
        const transfer: Transferable[] = [bitmap];
        if (input.remains) {
            const remainsCanvas = new OffscreenCanvas(1, 1);
            const remains = renderRemainsAtlas(input.remains, remainsCanvas);
            if (!remains) throw new Error('Unable to render blood remains atlas');
            remainsBitmap = remainsCanvas.transferToImageBitmap();
            prepared.remains = { canvas: remainsBitmap, tiles: remains.tiles };
            transfer.push(remainsBitmap);
        }
        scope.postMessage({ id, result: prepared }, transfer);
    } catch {
        bitmap?.close();
        remainsBitmap?.close();
        scope.postMessage({ id, result: null }, []);
    }
};
