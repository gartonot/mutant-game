import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLazyImageAsset, loadImageAsset } from '../src/rendering/ImageAsset';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

class FakeImage {
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoded = deferred<void>();
    decodeCalls = 0;
    decode() { this.decodeCalls++; return this.decoded.promise; }
    element() { return this as unknown as HTMLImageElement; }
}

function fixture() {
    const images: FakeImage[] = [];
    const lazy = createLazyImageAsset('/hero.png', () => {
        const image = new FakeImage();
        images.push(image);
        return image.element();
    });
    return { lazy, images };
}

test('registering a lazy asset does not create or request an image', () => {
    const { lazy, images } = fixture();
    assert.equal(lazy.asset, undefined);
    assert.equal(images.length, 0);
});

test('concurrent preparation shares a request, waits for decoding and reuses success', async () => {
    const { lazy, images } = fixture();
    const ready = lazy.ensure();
    assert.equal(lazy.ensure(), ready);
    assert.equal(images.length, 1);
    assert.equal(images[0].src, '/hero.png');
    images[0].onload!();
    let resolved = false;
    void ready.then(() => { resolved = true; });
    await Promise.resolve();
    assert.equal(resolved, false);
    assert.equal(lazy.asset!.loaded, false);
    images[0].decoded.resolve();
    assert.equal(await ready, true);
    assert.equal(lazy.asset!.loaded, true);
    assert.equal(lazy.ensure(), ready);
    assert.equal(images.length, 1);
    assert.equal(images[0].decodeCalls, 1);
    assert.equal(images[0].onload, null);
    assert.equal(images[0].onerror, null);
});

test('network failure allows a new attempt instead of caching a broken image', async () => {
    const { lazy, images } = fixture();
    const first = lazy.ensure();
    images[0].onerror!();
    assert.equal(await first, false);
    assert.equal(lazy.asset!.loaded, false);
    const retry = lazy.ensure();
    assert.notEqual(retry, first);
    assert.equal(lazy.ensure(), retry);
    assert.equal(images.length, 2);
    images[1].onload!();
    images[1].decoded.resolve();
    assert.equal(await retry, true);
    assert.equal(lazy.asset!.image, images[1].element());
});

test('decode failure also allows a successful retry', async () => {
    const { lazy, images } = fixture();
    const first = lazy.ensure();
    images[0].onload!();
    images[0].decoded.reject(new Error('Invalid image data'));
    assert.equal(await first, false);
    const retry = lazy.ensure();
    assert.equal(images.length, 2);
    images[1].onload!();
    images[1].decoded.resolve();
    assert.equal(await retry, true);
});

test('an image that never responds times out and clears its event handlers', async () => {
    const image = new FakeImage();
    const asset = loadImageAsset('/stalled.png', () => image.element(), 5);
    assert.equal(await asset.ready, false);
    assert.equal(asset.loaded, false);
    assert.equal(image.onload, null);
    assert.equal(image.onerror, null);
});

test('late decoding cannot turn a timed-out attempt into a successful asset', async () => {
    const image = new FakeImage();
    const asset = loadImageAsset('/slow-decode.png', () => image.element(), 5);
    image.onload!();
    assert.equal(await asset.ready, false);
    image.decoded.resolve();
    await Promise.resolve();
    assert.equal(asset.loaded, false);
    assert.equal(await asset.ready, false);
});
