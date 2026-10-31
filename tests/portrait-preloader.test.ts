import test from 'node:test';
import assert from 'node:assert/strict';
import { PortraitPreloader } from '../src/ui/PortraitPreloader';

function fixture() {
    const requests: { url: string; priority: string; image: HTMLImageElement; finish: () => void }[] = [];
    const createImage = () => {
        const image = {
            fetchPriority: '', decoding: '', onload: null as null | (() => void), onerror: null,
            decode: () => Promise.resolve(),
            set src(url: string) {
                requests.push({ url, priority: this.fetchPriority, image: this as unknown as HTMLImageElement,
                    finish: () => this.onload?.() });
            },
        };
        return image as unknown as HTMLImageElement;
    };
    return { requests, preloader: new PortraitPreloader(['a', 'b', 'c'], createImage) };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

test('portrait preloading waits for visible portrait and roster, then loads sequentially', async () => {
    const { requests, preloader } = fixture();
    let rosterDone!: () => void;
    const roster = new Promise<void>(resolve => { rosterDone = resolve; });
    preloader.prime('a');
    preloader.select('a', roster);
    assert.equal(requests.length, 1, 'priming and selection share the same request');
    assert.equal(requests[0].priority, 'high');
    requests[0].finish();
    await flush();
    assert.equal(requests.length, 1, 'thumbnails finish before background portraits compete');
    rosterDone();
    await flush();
    assert.deepEqual(requests.map(r => r.url), ['a', 'b']);
    assert.equal(requests[1].priority, 'low');
    requests[1].finish();
    await flush();
    assert.deepEqual(requests.map(r => r.url), ['a', 'b', 'c']);
    requests[2].finish();
    await flush();
    preloader.dispose();
});

test('selection promotes an in-flight background portrait and hiding stops the queue', async () => {
    const { requests, preloader } = fixture();
    preloader.select('a');
    requests[0].finish();
    await flush();
    preloader.select('b');
    assert.equal(requests.length, 2);
    assert.equal(requests[1].image.fetchPriority, 'high');
    preloader.pause();
    requests[1].finish();
    await flush();
    assert.equal(requests.length, 2);
    preloader.select('b');
    await flush();
    assert.equal(requests.length, 3, 'reopening reuses cached portraits and resumes the queue');
    preloader.dispose();
    requests[2].finish();
    await flush();
    preloader.select('new');
    assert.equal(requests.length, 3, 'disposed screens never start another request');
});
