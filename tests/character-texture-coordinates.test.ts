import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_IDS } from '../src/gameplay/ids';
import { CHARACTER_RIGS } from '../src/rendering/CharacterRig';
import { CHARACTER_TEXTURES } from '../src/assets/combat-scaled/dimensions';
import { CHARACTER_TEXTURE_RIGS, characterTextureRect } from '../src/rendering/CharacterTextureCoordinates';
import { drawGoliathSlamRaster } from '../src/rendering/GoliathSlamArt';
import type { ImageAsset } from '../src/rendering/ImageAsset';

test('compact textures preserve all world-space rig and grip coordinates for every hero', () => {
    for (const id of CHARACTER_IDS) {
        const before = CHARACTER_RIGS[id], after = CHARACTER_TEXTURE_RIGS[id], texture = CHARACTER_TEXTURES[id];
        assert.equal(after.target, before.target);
        assert.equal(after.fingers, before.fingers);
        assert.equal(after.palms, before.palms);
        assert.equal(after.headOcclusion, before.headOcclusion);
        assert.equal(after.rotation, before.rotation);
        for (let i = 0; i < 4; i++) {
            const scale = i % 2 === 0 ? texture.scaleX : texture.scaleY;
            assert.equal(after.source[i], before.source[i] * scale);
        }
    }
});

test('separate head crops use independent axes for rounded odd texture dimensions', () => {
    const texture = CHARACTER_TEXTURES.mercenary;
    assert.notEqual(texture.scaleX, texture.scaleY);
    const head = characterTextureRect('mercenary', [1240, 0, 534, 887]);
    assert.equal(head[0], 1240 * texture.scaleX);
    assert.equal(head[0] + head[2], texture.width);
    assert.ok(Math.abs(head[3] - texture.height) < 1e-10);
});

test('all Goliath slam pieces retain the full authored canvas under articulated masks', () => {
    const calls: unknown[][] = [];
    const ctx = new Proxy({ drawImage: (...args: unknown[]) => calls.push(args) }, {
        get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; },
        set() { return true; },
    }) as unknown as CanvasRenderingContext2D;
    const image = {} as HTMLImageElement;
    for (const progress of [0, .2, .5, .9]) {
        calls.length = 0;
        drawGoliathSlamRaster(ctx, { loaded: true, image } as ImageAsset, 70, 80, .4, progress);
        assert.equal(calls.length, 5);
        for (const call of calls) assert.deepEqual(call,
            [image, 0, 0, CHARACTER_TEXTURES.goliath.sourceWidth, CHARACTER_TEXTURES.goliath.sourceHeight]);
    }
});
