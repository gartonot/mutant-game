import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { basename, resolve } from 'node:path';

test('combat audio unlock leaves the network free; explicit preload shares work without replaying old shots', async () => {
    const { build } = createRequire(resolve('package.json'))('esbuild');
    const bundle = await build({
        stdin: { contents: "export { CombatAudio } from './src/audio/CombatAudio'; export { emitSound } from './src/audio/SoundEvents';", resolveDir: process.cwd(), loader: 'ts' },
        bundle: true, platform: 'node', format: 'esm', write: false, tsconfig: 'tsconfig.json',
        plugins: [{ name: 'audio-url-fixture', setup(plugin: { onResolve: Function; onLoad: Function }) {
            plugin.onResolve({ filter: /\.wav\?url$/ }, (args: { path: string }) => ({ path: basename(args.path).replace('?url', ''), namespace: 'audio-url' }));
            plugin.onLoad({ filter: /.*/, namespace: 'audio-url' }, (args: { path: string }) => ({ contents: `export default ${JSON.stringify('/' + args.path)}`, loader: 'js' }));
        } }],
    });
    const { CombatAudio, emitSound } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    const originals = new Map(['AudioContext', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const requests: { url: string; priority: string }[] = [];
    const decoded = new Map<string, Float32Array>();
    let release!: () => void;
    const network = new Promise<void>(resolve => { release = resolve; });
    let starts = 0;
    const node = { connect() { return this; }, disconnect() {} };
    class MockContext {
        state = 'running'; destination = node;
        createGain() { return { ...node, gain: { value: 0 } }; }
        createDynamicsCompressor() { return { ...node, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
        async resume() {}
        async close() {}
        async decodeAudioData(data: ArrayBuffer) {
            const url = new TextDecoder().decode(data);
            const samples = new Float32Array([1, .5]);
            decoded.set(url, samples);
            return { numberOfChannels: 1, getChannelData: () => samples };
        }
        createBufferSource() { return { ...node, start() { starts++; }, stop() {}, onended: null }; }
    }
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: MockContext });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (url: string, options: { priority: string }) => {
        requests.push({ url, priority: options.priority });
        await network;
        return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
    } });
    const audio = new CombatAudio();
    try {
        audio.unlock(); audio.unlock();
        assert.equal(requests.length, 0, 'first menu interactions only unlock the context');
        const loading = audio.preload();
        assert.equal(audio.preload(), loading);
        assert.equal(requests.length, 21);
        assert.ok(requests.every(request => request.priority === 'low'));
        audio.setActive(true);
        emitSound('pistol');
        assert.equal(starts, 0);
        release();
        await loading;
        assert.equal(await audio.prepare('pistol'), true);
        assert.equal(requests.length, 21, 'preview and activation reuse decoded buffers');
        assert.equal(starts, 0, 'a shot emitted while loading is not replayed later');
        emitSound('pistol');
        assert.equal(starts, 1);
        assert.deepEqual([...decoded.get('/explosion.wav')!], [.5, .25], 'blast scaling remains unchanged');
        assert.deepEqual([...decoded.get('/pistol.wav')!], [1, .5]);
    } finally {
        release(); audio.dispose();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
