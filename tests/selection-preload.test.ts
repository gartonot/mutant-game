import test from 'node:test';
import assert from 'node:assert/strict';
import { PortraitPreloader } from '../src/ui/PortraitPreloader';

type Request = { url: string; settled: boolean; finish: () => void; fail: () => void };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

function fixture(urls = ['a', 'b', 'c', 'd', 'e']) {
    const requests: Request[] = [];
    let active = 0, maximumActive = 0;
    const preloader = new PortraitPreloader(urls, () => {
        const image = {
            fetchPriority: '', decoding: '',
            onload: null as null | (() => void), onerror: null as null | (() => void),
            decode: () => Promise.resolve(),
            set src(url: string) {
                active++;
                maximumActive = Math.max(maximumActive, active);
                const request: Request = {
                    url, settled: false,
                    finish: () => settle(false), fail: () => settle(true),
                };
                const settle = (failed: boolean) => {
                    if (request.settled) return;
                    request.settled = true;
                    active--;
                    if (failed) this.onerror?.(); else this.onload?.();
                };
                requests.push(request);
            },
        };
        return image as unknown as HTMLImageElement;
    });
    const drain = async () => {
        for (let round = 0; round < urls.length + 2; round++) {
            requests.filter(request => !request.settled).forEach(request => request.finish());
            await flush();
        }
    };
    return { requests, preloader, drain, get maximumActive() { return maximumActive; } };
}

test('menu preparation shares prime, selection and concurrent preparation requests', async () => {
    const f = fixture();
    f.preloader.prime('a');
    const ready = f.preloader.prepareAll(2);
    const shared = f.preloader.prepareAll(2);
    const selected = f.preloader.select('b', Promise.resolve(), false);
    assert.deepEqual(f.requests.map(request => request.url), ['a', 'b']);
    assert.equal(f.preloader.isReady('a'), false);
    await f.drain();
    assert.equal(await ready, true);
    assert.equal(await shared, true);
    assert.equal(await selected, true);
    assert.equal(new Set(f.requests.map(request => request.url)).size, 5);
    assert.equal(f.requests.length, 5, 'warm-up and selection must not download duplicate portraits');
    assert.equal(f.preloader.isReady('a'), true);
    assert.equal(f.preloader.isReady('b'), true);
    assert.equal(f.maximumActive, 2);
    f.preloader.dispose();
});

test('menu portrait warm-up starts another request only when a worker becomes free', async () => {
    const f = fixture();
    const ready = f.preloader.prepareAll(2);
    assert.deepEqual(f.requests.map(request => request.url), ['a', 'b']);
    f.requests[0].finish();
    await flush();
    assert.deepEqual(f.requests.map(request => request.url), ['a', 'b', 'c']);
    await f.drain();
    assert.equal(await ready, true);
    assert.equal(f.maximumActive, 2);
    f.preloader.dispose();
});

test('failed menu preparation retries only the failed portrait and reuses decoded successes', async () => {
    const f = fixture(['a', 'b', 'c']);
    const first = f.preloader.prepareAll(3);
    f.requests[0].finish();
    f.requests[1].fail();
    f.requests[2].finish();
    assert.equal(await first, false);
    assert.equal(f.preloader.isReady('a'), true);
    assert.equal(f.preloader.isReady('b'), false);
    const retry = f.preloader.prepareAll(3);
    await flush();
    assert.deepEqual(f.requests.map(request => request.url), ['a', 'b', 'c', 'b']);
    f.requests[3].finish();
    assert.equal(await retry, true);
    assert.equal(f.preloader.isReady('b'), true);
    f.preloader.dispose();
});

test('disposing during preparation stops queued portraits and cannot report ready', async () => {
    const f = fixture();
    const ready = f.preloader.prepareAll(2);
    assert.equal(f.requests.length, 2);
    f.preloader.dispose();
    f.requests.forEach(request => request.finish());
    assert.equal(await ready, false);
    assert.equal(f.requests.length, 2);
    assert.equal(await f.preloader.prepareAll(2), false);
    assert.equal(f.requests.length, 2, 'a disposed screen must never resume its queued downloads');
});
