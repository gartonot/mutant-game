import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

test('equipment previews are immediate; independent shared sheets retry failures without mutating disposed roots', async () => {
    const { build } = createRequire(resolve('package.json'))('esbuild');
    const bundle = await build({
        stdin: { contents: "export * from './src/ui/EquipmentArtwork';", resolveDir: process.cwd(), loader: 'ts' },
        bundle: true, platform: 'node', format: 'esm', write: false, tsconfig: 'tsconfig.json',
        define: { 'import.meta.url': JSON.stringify('file:///test/rendering/module.ts') },
    });
    const originals = new Map(['Image', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
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
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement(tag: string) {
            assert.equal(tag, 'canvas');
            let crop = '';
            return { width: 0, height: 0,
                getContext: () => ({ drawImage(image: MockImage, ...coordinates: number[]) { crop = `${image.url}:${coordinates.join(',')}`; } }),
                toDataURL: () => `data:image/png;fixture,${crop}`,
            };
        },
    } });
    const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    const until = async (predicate: () => boolean) => {
        const deadline = Date.now() + 2000;
        while (!predicate() && Date.now() < deadline) await new Promise<void>(resolve => setTimeout(resolve, 0));
        assert.ok(predicate(), 'asynchronous atlas cropping must complete');
    };
    function image(dataset: Record<string, string>, initial: string) {
        let url = initial, writes = 0;
        return { dataset,
            get src() { return url; },
            set src(value: string) { url = value; writes++; },
            getAttribute(name: string) { return name === 'src' ? url : null; },
            get writes() { return writes; },
        };
    }
    try {
        const artwork = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
        const weaponPreview = artwork.equipmentWeaponIcon('pistol');
        const bonusPreview = artwork.equipmentBonusIcon('health', 'gold');
        assert.match(weaponPreview, /^data:image\//);
        assert.match(bonusPreview, /^data:image\//);
        assert.equal(requests.length, 0, 'embedded previews need no image request');

        function root() {
            const weapon = image({ weaponArt: 'pistol' }, weaponPreview);
            const bonus = image({ bonusArt: 'gold:health' }, bonusPreview);
            const element = { isConnected: true, querySelectorAll(selector: string) {
                if (selector === 'img[data-weapon-art]') return [weapon];
                assert.equal(selector, 'img[data-bonus-art]');
                return [bonus];
            } };
            return { element: element as unknown as HTMLElement, weapon, bonus };
        }
        const live = root(), disposed = root();
        artwork.refreshEquipmentArtwork(live.element);
        artwork.refreshEquipmentArtwork(disposed.element);
        // The mock models removal without a browser DOM.
        (disposed.element as unknown as { isConnected: boolean }).isConnected = false;
        assert.equal(requests.length, 2, 'different roots share the same two in-flight sheets');
        assert.ok(requests.every(request => request.fetchPriority === 'high'));
        const weaponRequest = requests.find(request => request.url.endsWith('/weapons.webp'))!;
        const bonusRequest = requests.find(request => request.url.endsWith('/bonuses.webp'))!;
        assert.ok(weaponRequest && bonusRequest);
        weaponRequest.onerror!();
        bonusRequest.onload!();
        await until(() => live.bonus.src !== bonusPreview);
        assert.equal(live.weapon.src, weaponPreview, 'failed weapons retain the immediate preview');
        assert.notEqual(live.bonus.src, bonusPreview, 'bonuses improve without waiting for weapons');
        assert.match(live.bonus.src, /bonuses\.webp:/);
        assert.equal(disposed.weapon.writes, 0);
        assert.equal(disposed.bonus.writes, 0, 'detached views are never mutated by late completion');

        artwork.refreshEquipmentArtwork(live.element);
        artwork.refreshEquipmentArtwork(disposed.element);
        assert.equal(requests.length, 3, 'only the failed sheet is requested again');
        assert.equal(requests[2].url, weaponRequest.url);
        requests[2].onload!();
        await until(() => live.weapon.src !== weaponPreview);
        assert.notEqual(live.weapon.src, weaponPreview);
        assert.match(live.weapon.src, /weapons\.webp:/);
        assert.equal(live.bonus.writes, 1, 'reusing the ready sheet does not rewrite the same source');
        assert.equal(disposed.weapon.writes, 0);
        assert.equal(disposed.bonus.writes, 0);
        assert.equal(artwork.equipmentWeaponIcon('pistol'), live.weapon.src);
        assert.equal(artwork.equipmentBonusIcon('health', 'gold'), live.bonus.src);
    } finally {
        for (const request of requests) request.onerror?.();
        await flush();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
