import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareBloodDecal, warmBloodDecalWorkers } from '../src/effects/BloodDecalWorkerPool';

test('blood workers balance unique requests, retain source data and release abandoned results', async () => {
    const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    const canvasDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
    const instances: FakeWorker[] = [];
    class FakeWorker {
        onmessage: ((event: { data: unknown }) => void) | null = null;
        onerror: (() => void) | null = null;
        onmessageerror: (() => void) | null = null;
        messages: { id: number; input: unknown }[] = [];
        terminated = false;
        constructor() { instances.push(this); }
        postMessage(message: { id: number; input: unknown }, transfer?: unknown) {
            assert.equal(transfer, undefined, 'original contour buffers must not be transferred');
            this.messages.push(message);
        }
        terminate() { this.terminated = true; }
    }
    try {
        Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
        Object.defineProperty(globalThis, 'OffscreenCanvas', { configurable: true, value: class {} });
        warmBloodDecalWorkers();
        warmBloodDecalWorkers();
        assert.equal(instances.length, 2);
        const input = { shapes: [], color: '#a0181c', seed: 47 };
        const first = prepareBloodDecal(input);
        const second = prepareBloodDecal({ ...input, seed: 48 });
        const third = prepareBloodDecal({ ...input, seed: 49 });
        assert.deepEqual(instances.map(worker => worker.messages.length), [2, 1]);
        assert.deepEqual(instances.map(worker => worker.messages.map(message => (message.input as typeof input).seed)), [[47, 49], [48]]);
        const ready = { canvas: { close() {} }, x: -20, y: -15,
            remains: { canvas: { close() {} }, tiles: [] } };
        instances[1].onmessage!({ data: { id: instances[1].messages[0].id, result: ready } });
        assert.equal(await second, ready);
        instances[0].onerror!();
        assert.equal(await first, null);
        assert.equal(await third, null);
        assert.equal(instances[0].terminated, true);
        let closed = false;
        let remainsClosed = false;
        instances[0].onmessage!({ data: { id: instances[0].messages[0].id,
            result: { canvas: { close() { closed = true; } }, x: 0, y: 0,
                remains: { canvas: { close() { remainsClosed = true; } }, tiles: [] } } } });
        assert.equal(closed, true);
        assert.equal(remainsClosed, true);
        const fourth = prepareBloodDecal(input);
        assert.equal(instances[1].messages.length, 2);
        instances[1].onmessageerror!();
        assert.equal(await fourth, null);
        assert.equal(await prepareBloodDecal(input), null);
    } finally {
        for (const [key, descriptor] of [['Worker', workerDescriptor], ['OffscreenCanvas', canvasDescriptor]] as const) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
