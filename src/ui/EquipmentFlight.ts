export interface EquipmentFlightSource {
    src: string;
    rect: DOMRect;
}

/** Decorative only: loadout changes never wait for an animation. */
export class EquipmentFlight {
    private readonly flights = new Set<() => void>();

    capture(button: Element): EquipmentFlightSource | null {
        const image = button.querySelector('img');
        return image ? { src: image.currentSrc || image.src, rect: image.getBoundingClientRect() } : null;
    }

    cancel(): void { for (const finish of [...this.flights]) finish(); }

    play(source: EquipmentFlightSource | null, slot: HTMLElement | null, root: HTMLElement): void {
        const destination = slot?.querySelector('img');
        if (!source || !slot || !destination || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const end = destination.getBoundingClientRect(), start = source.rect;
        if (!start.width || !start.height || !end.width || !end.height) return;
        const bounds = root.getBoundingClientRect();
        const catalog = slot.closest('.equipment-catalog')?.getBoundingClientRect();
        const hiddenTarget = !!catalog && (end.top < catalog.top || end.bottom > catalog.bottom
            || end.left < catalog.left || end.right > catalog.right);
        // A scrolled-away card has a misleading screen position. Return into the visible
        // inventory instead, without scrolling to it or flying back above the equipment slots.
        const targetScale = hiddenTarget ? Math.min(1, 72 / Math.max(end.width, end.height)) : 1;
        const targetWidth = end.width * targetScale;
        const targetHeight = end.height * targetScale;
        const targetX = hiddenTarget ? Math.max(catalog!.left + targetWidth / 2 + 12,
            Math.min(catalog!.right - targetWidth / 2 - 12, end.left + end.width / 2)) : end.left + end.width / 2;
        const targetY = hiddenTarget ? catalog!.top + Math.min(catalog!.height / 2, 90) : end.top + end.height / 2;
        const layer = document.createElement('div');
        layer.className = 'equipment-flight-layer';
        layer.setAttribute('aria-hidden', 'true');
        Object.assign(layer.style, { left: `${bounds.left}px`, top: `${bounds.top}px`,
            width: `${bounds.width}px`, height: `${bounds.height}px`, borderRadius: getComputedStyle(root).borderRadius });
        const ghost = document.createElement('img');
        ghost.src = source.src;
        ghost.alt = '';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.className = 'equipment-flight';
        Object.assign(ghost.style, { left: `${start.left - bounds.left}px`, top: `${start.top - bounds.top}px`,
            width: `${start.width}px`, height: `${start.height}px` });
        layer.append(ghost);
        document.body.append(layer);
        destination.style.visibility = 'hidden';
        const dx = targetX - start.left - start.width / 2;
        const dy = targetY - start.top - start.height / 2;
        const sx = targetWidth / start.width, sy = targetHeight / start.height;
        const animation = ghost.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${dx * .48}px, ${dy * .48 + (catalog ? 18 : -45)}px) scale(${1 + (sx - 1) * .4}, ${1 + (sy - 1) * .4})`, opacity: 1, offset: .48 },
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: hiddenTarget ? 0 : 1 },
        ], { duration: 460, easing: 'cubic-bezier(.22,.65,.25,1)', fill: 'forwards' });
        let frame = 0;
        const finish = () => {
            cancelAnimationFrame(frame);
            animation.cancel(); layer.remove(); destination.style.visibility = '';
            this.flights.delete(finish);
        };
        this.flights.add(finish);
        // Navigation and starting battle may hide an ancestor without disposing this screen.
        const watch = () => {
            if (!root.getClientRects().length || !slot.isConnected) { finish(); return; }
            const current = destination.getBoundingClientRect();
            if (Math.abs(current.left - end.left) > 1 || Math.abs(current.top - end.top) > 1) { finish(); return; }
            frame = requestAnimationFrame(watch);
        };
        frame = requestAnimationFrame(watch);
        animation.finished.then(() => {
            finish();
            if (!hiddenTarget && slot.isConnected && root.getClientRects().length) slot.animate([
                { boxShadow: '0 0 0 0 #c8ed8699' },
                { boxShadow: '0 0 0 8px #c8ed8600' },
            ], { duration: 280, easing: 'ease-out' });
        }, () => { /* Canceled by another selection, scrolling or navigation. */ });
    }
}
