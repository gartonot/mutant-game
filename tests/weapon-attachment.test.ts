import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTER_IDS } from '../src/gameplay/ids';
import { CHARACTER_RIGS, drawRigBody } from '../src/rendering/CharacterRig';
import { drawHandOverlay } from '../src/rendering/HandOverlay';
import { muzzlePosition, weaponAttachment, weaponMount, WEAPON_ORDER, WEAPON_RIGS } from '../src/rendering/WeaponGeometry';
import { loadImageAsset } from '../src/rendering/ImageAsset';

type Point = { x: number; y: number };

test('destroyer screenshot corrections retain their individual stock pivots', () => {
    const corrections = { rifle: [-18, 7, -.12], shotgun: [-15, 8, -.24], m16: [-14, 9, -.21],
        'machine-gun': [-12, 0, 0], ak47: [-15, 8, -.14],
        'plasma-auto': [-15, 7, -.20], 'double-barrel': [-10, 4, -.15],
        flamethrower: [-13, 1, 0], laser: [-11, 5, -.13],
        'skull-launcher': [-9, 5, -.14], 'plasma-cannon': [-14, 5.5, -.10],
        'grenade-launcher': [-40, 13, -.13] };
    for (const character of CHARACTER_IDS) for (const weapon of WEAPON_ORDER) {
        if (character !== 'destroyer') continue;
        const a = weaponAttachment(character, weapon);
        const correction = character === 'destroyer' ? corrections[weapon as keyof typeof corrections] : undefined;
        assert.equal(a.adjusted, !!correction, `${character}/${weapon} correction scope`);
        if (!correction) { assert.equal(a.angle, 0); continue; }
        const [dx, dy, angle] = correction;
        assert.equal(a.angle, angle);
        const grip = WEAPON_RIGS[weapon].grip;
        // Destroyer's clasped palms average to (50.6, 6.35). Stock is canonical x=-14.
        near({ x: a.x - 14 * Math.cos(angle), y: a.y - 14 * Math.sin(angle) },
            { x: 50.6 - grip.x - 14 + dx, y: 6.35 - grip.y + dy }, `${weapon} stock`);
        const kicked = weaponAttachment(character, weapon, 6);
        if (weapon === 'grenade-launcher') {
            assert.equal(a.supportKind, 'shoulder');
            near(a.support, { x: 12, y: 17 }, 'shoulder contact');
            near(kicked.support, { x: 6, y: 17 }, 'shoulder recoil');
        }
        near(kicked.muzzle, { x: a.muzzle.x - 6, y: a.muzzle.y }, `${weapon} recoil`);
    }
});

test('other heroes share requested tilt groups and shoulder mount without changing compact weapons', () => {
    const tilted = new Set(['rifle', 'shotgun', 'm16', 'ak47', 'plasma-auto', 'double-barrel', 'laser']);
    for (const character of CHARACTER_IDS.filter(id => id !== 'destroyer')) for (const weapon of WEAPON_ORDER) {
        const a = weaponAttachment(character, weapon);
        const compact = weapon === 'pistol' || weapon === 'plasma-grenade';
        assert.equal(a.adjusted, !compact, `${character}/${weapon}`);
        assert.equal(a.angle, tilted.has(weapon) || weapon === 'grenade-launcher' ? -5 * Math.PI / 180 : 0);
        if (weapon === 'grenade-launcher') {
            near(a, { x: 8, y: 18 }, `${character} shoulder mount`);
            assert.equal(a.supportKind, 'shoulder');
            near(a.support, { x: 12, y: 18 }, `${character} shoulder contact`);
        }
    }
});

test('cached render mounts agree with diagnostics for every character and weapon', () => {
    for (const character of CHARACTER_IDS) for (const weapon of WEAPON_ORDER) {
        const mount = weaponMount(character, weapon);
        near(mount, weaponAttachment(character, weapon), `${character}/${weapon}`);
        assert.equal(mount, weaponMount(character, weapon), 'hot path reuses immutable coordinates');
        assert.ok(Object.isFrozen(mount), 'callers cannot corrupt later frames');
    }
});

test('image loading settles success and failure, and installs handlers before setting src', async () => {
    for (const success of [true, false]) {
        let assigned = '';
        const fake = {
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
            set src(url: string) {
                assigned = url;
                assert.ok(this.onload && this.onerror, 'cached images can load immediately');
                (success ? this.onload : this.onerror)();
            },
        };
        const asset = loadImageAsset('test.png', () => fake as unknown as HTMLImageElement);
        assert.equal(await asset.ready, success);
        assert.equal(asset.loaded, success);
        assert.equal(assigned, 'test.png');
        assert.equal(asset.image, fake);
        assert.equal(fake.onload, null);
        assert.equal(fake.onerror, null);
    }
});

test('pending image loads keep raster fallback active until completion', async () => {
    const fake = { onload: null as (() => void) | null, onerror: null, src: '' };
    const asset = loadImageAsset('delayed.png', () => fake as unknown as HTMLImageElement);
    assert.equal(asset.loaded, false);
    fake.onload!();
    assert.equal(await asset.ready, true);
    assert.equal(asset.loaded, true);
});
function near(actual: Point, expected: Point, label: string) {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-8 && Math.abs(actual.y - expected.y) < 1e-8,
        `${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

test('known palm calibrations survive crop conversion and authored body rotation', () => {
    assert.deepEqual(CHARACTER_RIGS.destroyer.palms, [{ x: 49.1, y: 8.5 }, { x: 52.1, y: 4.2 }]);
    // Telepath source palm (885,637), crop origin (87,277), width 1111 -> 78 game units.
    near(CHARACTER_RIGS.telepath.palms[0], {
        x: -28.293429342934292 + (885 - 87) * 78 / 1111,
        y: -24.08100810081008 + (637 - 277) * 78 / 1111,
    }, 'telepath crop');
    // Cyborg retains a rotated source pose; use it as the rotation regression fixture.
    const x = -36.4009900990099 + (885 - 22) * 86 / 1212;
    const y = -34.98184818481848 + (802 - 157) * 86 / 1212;
    const angle = .30400093934014455;
    near(CHARACTER_RIGS.cyborg.palms[0], {
        x: x * Math.cos(angle) - y * Math.sin(angle),
        y: x * Math.sin(angle) + y * Math.cos(angle),
    }, 'cyborg rotated crop');
});

test('all 210 combinations retain weapon size, attach to the appropriate palm and keep support clear of muzzle', () => {
    let count = 0;
    const claspedCharacters = new Set(['mercenary', 'assassin', 'destroyer']);
    for (const character of CHARACTER_IDS) for (const weapon of WEAPON_ORDER) {
        const label = `${character}/${weapon}`;
        const [rear, front] = CHARACTER_RIGS[character].palms;
        const clasped = claspedCharacters.has(character);
        const compact = weapon === 'pistol' || weapon === 'plasma-grenade';
        const expected = clasped ? { x: (rear.x + front.x) / 2, y: (rear.y + front.y) / 2 }
            : compact ? front : rear;
        for (const recoil of [0, 4.75]) {
            const attachment = weaponAttachment(character, weapon, recoil);
            const grip = WEAPON_RIGS[weapon].grip;
            if (!attachment.adjusted) near(attachment.primary, { x: expected.x - recoil, y: expected.y }, `${label} primary`);
            const cos = Math.cos(attachment.angle), sin = Math.sin(attachment.angle);
            near({ x: attachment.x + grip.x * cos - grip.y * sin, y: attachment.y + grip.x * sin + grip.y * cos }, attachment.primary, `${label} grip`);
            assert.equal(attachment.scale, 1, `${label} must not deform or shrink`);
            assert.equal(attachment.supportActive, clasped || !compact, `${label} support mode`);
            assert.equal(attachment.supportValid, true, `${label} support valid`);
            if (attachment.supportActive) {
                const zone = attachment.supportZone;
                assert.ok(attachment.support.x >= zone.xMin && attachment.support.x <= zone.xMax, `${label} support X`);
                assert.ok(attachment.support.y >= zone.yMin && attachment.support.y <= zone.yMax, `${label} support Y`);
                assert.ok(attachment.support.x < attachment.muzzle.x - 3, `${label} fingers behind muzzle`);
            }
            // Geometry can be loaded and used here with no document, Image or loaded sprites.
            near(muzzlePosition(weapon, 10, 20, Math.PI / 2, character, recoil),
                { x: 10 - attachment.muzzle.y, y: 20 + attachment.muzzle.x }, `${label} rotated muzzle`);
        }
        count++;
    }
    assert.equal(count, 210);
});

/** Minimal affine Canvas recorder: tests actual transform order, not a list of expected API calls. */
function recorder() {
    type Matrix = [number, number, number, number, number, number];
    let matrix: Matrix = [1, 0, 0, 1, 0, 0];
    const stack: Matrix[] = [];
    const images: Matrix[] = [];
    const fingers: Point[] = [];
    const point = (x: number, y: number) => ({ x: matrix[0] * x + matrix[2] * y + matrix[4],
        y: matrix[1] * x + matrix[3] * y + matrix[5] });
    const ctx = {
        save() { stack.push([...matrix]); },
        restore() { matrix = stack.pop()!; },
        translate(x: number, y: number) { const next = point(x, y); matrix[4] = next.x; matrix[5] = next.y; },
        rotate(angle: number) {
            const [a, b, c, d, e, f] = matrix, cos = Math.cos(angle), sin = Math.sin(angle);
            matrix = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
        },
        drawImage() { images.push([...matrix]); },
        ellipse(x: number, y: number) { fingers.push(point(x, y)); },
        beginPath() {}, moveTo() {}, clip() {},
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, images, fingers, point };
}

test('body and copied fingers recoil together in aim space even when sprite and player both rotate', () => {
    const aim = 1.1, recoil = 4.75, image = {} as HTMLImageElement;
    for (const character of CHARACTER_IDS) {
        const rig = CHARACTER_RIGS[character], rec = recorder();
        rec.ctx.translate(17, -23);
        rec.ctx.rotate(aim);
        const before = rec.point(0, 0);
        drawRigBody(rec.ctx, image, rig, recoil);
        drawHandOverlay(rec.ctx, image, rig.source, rig.target, rig.fingers, rig.rotation, recoil);
        assert.deepEqual(rec.images[0], rec.images[1], `${character} finger/body transform`);
        near(rec.point(0, 0), before, `${character} restores parent transform`);
        const actualPalms = rec.fingers.map(p => ({
            x: (p.x - 17) * Math.cos(aim) + (p.y + 23) * Math.sin(aim),
            y: -(p.x - 17) * Math.sin(aim) + (p.y + 23) * Math.cos(aim),
        })).sort((a, b) => a.x - b.x);
        for (const [index, palm] of rig.palms.entries()) {
            near(actualPalms[index], { x: palm.x - recoil, y: palm.y }, `${character} recoil palm ${index}`);
        }
    }
});
