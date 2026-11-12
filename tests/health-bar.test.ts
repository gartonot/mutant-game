import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HealthBar } from '../src/ui/HealthBar';

function render(bar: HealthBar) {
    const text: string[] = [];
    const fills: { color: string | string[]; alpha: number; path: number[][] }[] = [];
    const savedAlpha: number[] = [];
    let path: number[][] = [];
    const canvas = {
        fillStyle: '' as string | { colors: string[] },
        globalAlpha: 1,
        save() { savedAlpha.push(this.globalAlpha); },
        restore() { this.globalAlpha = savedAlpha.pop()!; },
        beginPath() { path = []; },
        arc(_x: number, _y: number, radius: number, start: number, end: number) { path.push([radius, start, end]); },
        lineTo(x: number, y: number) { path.push([x, y]); },
        closePath() {}, stroke() {}, strokeText() {},
        fill() {
            fills.push({ color: typeof this.fillStyle === 'string' ? this.fillStyle : this.fillStyle.colors,
                alpha: this.globalAlpha, path });
        },
        createLinearGradient() {
            return { colors: [] as string[], addColorStop(_position: number, color: string) { this.colors.push(color); } };
        },
        fillText(content: string) { text.push(content); },
    };
    bar.draw(canvas as unknown as CanvasRenderingContext2D);
    return { text, fills };
}

test('healing highlight tracks actual HP under simultaneous damage, stays still on pause, then fades', (t) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerWidth: 1000, innerHeight: 700 } });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'window', original);
        else Reflect.deleteProperty(globalThis, 'window');
    });
    const bar = new HealthBar(100);
    bar.update(60, 359500, 0);
    assert.ok(render(bar).fills.every(fill => typeof fill.color === 'string'));
    bar.update(65, 359450, 5);
    bar.update(56.5, 359434, 6.5); // +1.5 HP of healing and a 10 HP hit in the same tick.
    const frame = render(bar);
    const glow = frame.fills.find(fill => Array.isArray(fill.color));
    assert.ok(glow && glow.alpha > 0);
    assert.ok(glow.color.includes('#fff287'));
    assert.equal(glow.path[0][2], Math.PI * (1 + 56.5 / 100));
    assert.equal(frame.fills.find(fill => fill.color === '#d00400')?.path[0][2], glow.path[0][2]);
    assert.equal(frame.text[0], '57');
    assert.deepEqual(render(bar), frame);
    bar.update(56.5, 359434, 6.5);
    assert.deepEqual(render(bar), frame);
    bar.update(56.5, 359234, 6.5);
    const after = render(bar);
    assert.ok(after.fills.every(fill => typeof fill.color === 'string'));
    assert.equal(after.text[0], '57');
});
