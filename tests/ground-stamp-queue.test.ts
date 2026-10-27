import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GroundStampQueue } from '../src/effects/GroundStampQueue';

const ctx = {} as CanvasRenderingContext2D;
function deferred<T>() {
    let resolve!: (value: T | null) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T | null>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

test('ground stamps preserve death and scorch order when worker results arrive reversed', async () => {
    const queue = new GroundStampQueue(() => 0);
    const first = deferred<string>(), second = deferred<string>();
    const calls: string[] = [];
    queue.enqueueAsync(first.promise, (_ctx, value) => calls.push(value!), value => calls.push(`release ${value}`));
    queue.enqueue(() => calls.push('scorch'));
    queue.enqueueAsync(second.promise, (_ctx, value) => calls.push(value!), value => calls.push(`release ${value}`));
    assert.equal(queue.pendingCount, 3);
    second.resolve('second'); await Promise.resolve();
    queue.flush(ctx); assert.deepEqual(calls, []);
    first.resolve('first'); await Promise.resolve();
    queue.flush(ctx);
    assert.deepEqual(calls, ['first', 'release first', 'scorch', 'second', 'release second']);
    assert.equal(queue.pendingCount, 0);
    queue.flush(ctx); assert.equal(calls.length, 5);
});

test('failed and null ground results use ordered fallback within the frame budget', async () => {
    let clock = 0;
    const queue = new GroundStampQueue(() => clock);
    const failed = deferred<string>();
    const values: (string | null)[] = [];
    const draw = (_ctx: CanvasRenderingContext2D, value: string | null) => { values.push(value); clock += 5; };
    const release = () => assert.fail('null results do not own resources');
    queue.enqueueAsync(failed.promise, draw, release);
    queue.enqueueAsync(Promise.resolve(null), draw, release);
    failed.reject(new Error('worker failed')); await Promise.resolve();
    queue.flush(ctx); assert.deepEqual(values, [null]);
    queue.flush(ctx); assert.deepEqual(values, [null, null]);
});

test('disposing a ground queue releases ready and late resources without drawing', async () => {
    const queue = new GroundStampQueue(() => 0);
    const early = deferred<string>(), late = deferred<string>();
    const releases: string[] = [];
    const draw = () => assert.fail('disposed queue must not draw');
    queue.enqueueAsync(early.promise, draw, value => releases.push(value));
    queue.enqueueAsync(late.promise, draw, value => releases.push(value));
    early.resolve('early'); await Promise.resolve();
    queue.dispose(); queue.dispose();
    assert.equal(queue.pendingCount, 0);
    assert.deepEqual(releases, ['early']);
    late.resolve('late'); await Promise.resolve();
    queue.enqueue(draw);
    queue.enqueueAsync(Promise.resolve('after disposal'), draw, value => releases.push(value));
    await Promise.resolve(); queue.flush(ctx);
    assert.deepEqual(releases, ['early', 'late', 'after disposal']);
});

test('ground flush always draws one ready stamp and bounds synchronous fallback bursts', () => {
    let clock = 0, calls = 0;
    const queue = new GroundStampQueue(() => clock);
    for (let i = 0; i < 300; i++) queue.enqueue(() => { calls++; clock += 2; });
    queue.flush(ctx, 0); assert.equal(calls, 1);
    queue.flush(ctx, 4); assert.equal(calls, 3);
    for (let i = 0; i < 149; i++) queue.flush(ctx, 4);
    assert.equal(calls, 300);
    queue.flush(ctx); assert.equal(calls, 300);
});

test('ground stamp resources are released even if drawing throws', async () => {
    const queue = new GroundStampQueue(() => 0);
    const releases: string[] = [];
    queue.enqueueAsync(Promise.resolve('bitmap'), () => { throw new Error('drawing failed'); }, value => releases.push(value));
    await Promise.resolve();
    assert.throws(() => queue.flush(ctx), /drawing failed/);
    queue.dispose(); assert.deepEqual(releases, ['bitmap']);
});
