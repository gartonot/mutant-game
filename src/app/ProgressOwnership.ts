export type OwnershipResult = { status: 'owned'; release: () => void } | { status: 'busy' | 'unsupported' | 'error' };

/** The callback stays pending for the owner's entire application lifetime. */
export function acquireProgressOwnership(locks: LockManager | undefined): Promise<OwnershipResult> {
    if (!locks) return Promise.resolve({ status: 'unsupported' });
    return new Promise(resolve => {
        try {
            void locks.request('mutant.progress.writer.v1', { mode: 'exclusive', ifAvailable: true }, lock => {
                if (!lock) { resolve({ status: 'busy' }); return; }
                return new Promise<void>(release => resolve({ status: 'owned', release }));
            }).catch(() => resolve({ status: 'error' }));
        } catch { resolve({ status: 'error' }); }
    });
}
