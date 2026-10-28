import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acquireProgressOwnership } from '../src/app/ProgressOwnership';

function lockManager() {
    let occupied = false;
    return {
        request: async (_name: string, options: { ifAvailable: boolean; mode: string }, callback: (lock: object | null) => Promise<void> | void) => {
            assert.equal(options.ifAvailable, true);
            assert.equal(options.mode, 'exclusive');
            if (occupied) return callback(null);
            occupied = true;
            try { await callback({}); } finally { occupied = false; }
        },
    } as unknown as LockManager;
}

test('simultaneous app starts allow exactly one writer, release enables a fresh owner', async () => {
    const locks = lockManager();
    const [first, second] = await Promise.all([acquireProgressOwnership(locks), acquireProgressOwnership(locks)]);
    assert.equal(first.status, 'owned');
    assert.equal(second.status, 'busy');
    assert.equal((await acquireProgressOwnership(locks)).status, 'busy');
    if (first.status !== 'owned') return;
    first.release(); first.release();
    await Promise.resolve();
    const next = await acquireProgressOwnership(locks);
    assert.equal(next.status, 'owned');
    if (next.status === 'owned') next.release();
});

test('unsupported or rejected lock requests never grant progress ownership', async () => {
    assert.equal((await acquireProgressOwnership(undefined)).status, 'unsupported');
    const rejected = { request: () => Promise.reject(new Error('denied')) } as unknown as LockManager;
    assert.equal((await acquireProgressOwnership(rejected)).status, 'error');
    const throws = { request: () => { throw new Error('denied'); } } as unknown as LockManager;
    assert.equal((await acquireProgressOwnership(throws)).status, 'error');
});
