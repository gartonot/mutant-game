import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

test('upgrade cards have embedded previews and share one retryable atlas preparation', async () => {
    const { build } = createRequire(resolve('package.json'))('esbuild');
    const bundle = await build({
        stdin: { contents: "export * from './src/ui/UpgradeArtwork'; export { UPGRADE_LAYOUT } from './src/assets/upgrades-runtime/layout';", resolveDir: process.cwd(), loader: 'ts' },
        bundle: true, platform: 'node', format: 'esm', write: false, tsconfig: 'tsconfig.json',
        define: { 'import.meta.url': JSON.stringify('file:///test/rendering/module.ts') },
    });
    const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
    const requests: MockImage[] = [];
    class MockImage {
        url = '';
        fetchPriority = '';
        decoding = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(url: string) { this.url = url; requests.push(this); }
        get src() { return this.url; }
        async decode() {}
    }
    Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
    try {
        const artwork = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
        const ids = Object.keys(artwork.UPGRADE_LAYOUT.cells);
        assert.equal(ids.length, 10, 'all ten implant/arsenal illustrations are present');
        const positions = new Set<string>();
        for (const id of ids) {
            const markup = artwork.upgradeArtwork(id);
            assert.match(markup, /class="upgrade-art"/);
            assert.match(markup, /data:image\//, `${id} includes an offline preview`);
            assert.match(markup, /upgrades\.webp/);
            const position = markup.match(/background-position:([^";]+)/)?.[1];
            assert.ok(position, `${id} has an atlas position`);
            positions.add(position);
        }
        assert.equal(positions.size, 10, 'each illustration uses a separate cell');
        assert.equal(requests.length, 0, 'rendering card/tooltip markup does not create image requests');

        const first = artwork.prepareUpgradeArtwork();
        assert.equal(artwork.prepareUpgradeArtwork(), first, 'concurrent callers share preparation');
        assert.equal(requests.length, 1);
        assert.equal(requests[0].fetchPriority, 'high');
        assert.equal(requests[0].decoding, 'async');
        requests[0].onerror!();
        assert.equal(await first, false);

        const retry = artwork.prepareUpgradeArtwork();
        assert.notEqual(retry, first);
        assert.equal(artwork.prepareUpgradeArtwork(), retry);
        assert.equal(requests.length, 2, 'failed preparation creates exactly one new image');
        assert.equal(requests[1].url, requests[0].url);
        requests[1].onload!();
        assert.equal(await retry, true);
        assert.equal(artwork.prepareUpgradeArtwork(), retry, 'successful preparation remains cached');
        assert.equal(requests.length, 2);
    } finally {
        for (const request of requests) request.onerror?.();
        if (original) Object.defineProperty(globalThis, 'Image', original);
        else Reflect.deleteProperty(globalThis, 'Image');
    }
});
