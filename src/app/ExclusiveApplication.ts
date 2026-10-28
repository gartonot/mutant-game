import { acquireProgressOwnership } from './ProgressOwnership';
import './battle-preparation.css';

/** Acquire before constructing any stores, including menu upgrades and equipment. */
export function startExclusiveApplication(create: () => () => void): () => void {
    const events = new AbortController();
    const dialog = document.createElement('dialog');
    dialog.className = 'battle-preparation';
    dialog.innerHTML = '<p role="status" aria-live="polite"></p><button type="button">Повторить</button>';
    document.body.append(dialog);
    const status = dialog.querySelector('p')!;
    const retry = dialog.querySelector('button')!;
    let disposeApp: (() => void) | undefined;
    let release: (() => void) | undefined;
    let generation = 0;
    let pending = false;
    let startupFailed = false;
    function stop() {
        generation++;
        pending = false;
        // Tear down input handlers and all writers before releasing ownership.
        try { disposeApp?.(); } finally { disposeApp = undefined; release?.(); release = undefined; }
    }
    async function start() {
        if (pending || release || events.signal.aborted) return;
        pending = true;
        const attempt = ++generation;
        status.textContent = 'Проверка доступа к сохранению…';
        retry.hidden = true;
        if (!dialog.open) dialog.showModal();
        const owner = await acquireProgressOwnership(navigator.locks);
        if (events.signal.aborted || attempt !== generation) {
            if (owner.status === 'owned') owner.release();
            return;
        }
        pending = false;
        if (owner.status === 'owned') {
            release = owner.release;
            try { disposeApp = create(); dialog.close(); }
            catch {
                // A failed constructor may already have installed listeners. Keep its lock
                // until navigation destroys the document, rather than admit a second writer.
                startupFailed = true;
                status.textContent = 'Не удалось запустить игру. Перезагрузи страницу.';
                retry.textContent = 'Перезагрузить';
                retry.hidden = false;
            }
            return;
        }
        status.textContent = owner.status === 'busy'
            ? 'Игра уже открыта в другой вкладке. Закрой её и нажми «Повторить», чтобы загрузить последнее сохранение.'
            : owner.status === 'unsupported'
                ? 'Браузер не поддерживает защиту сохранения. Открой игру по HTTPS в актуальном браузере.'
                : 'Не удалось получить доступ к сохранению. Попробуй ещё раз.';
        retry.hidden = owner.status === 'unsupported';
    }
    dialog.addEventListener('cancel', event => event.preventDefault(), { signal: events.signal });
    retry.addEventListener('click', () => { if (startupFailed) window.location.reload(); else void start(); }, { signal: events.signal });
    window.addEventListener('pagehide', () => { if (!startupFailed) stop(); }, { signal: events.signal });
    // BFCache restores this document with old closures: rebuild every store under a fresh lock.
    window.addEventListener('pageshow', event => {
        if (!event.persisted) return;
        if (startupFailed) window.location.reload(); else void start();
    }, { signal: events.signal });
    void start();
    return () => { events.abort(); stop(); dialog.remove(); };
}
