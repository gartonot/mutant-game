/** Menu-only presentation, kept outside battle lifecycle and input handling. */
export function setupModeDescriptions(signal: AbortSignal): () => void {
    const description = document.querySelector<HTMLElement>('.mode-description')!;
    const text = document.querySelector<HTMLElement>('#description')!;
    const content = document.querySelector<HTMLElement>('.menu-content')!;
    const panel = document.querySelector<HTMLElement>('.menu-panel')!;
    let describedButton: HTMLButtonElement | undefined;
    const hide = () => {
        description.classList.remove('visible');
        description.setAttribute('aria-hidden', 'true');
    };
    const position = () => {
        if (!describedButton) return;
        const offset = describedButton.getBoundingClientRect().top - content.getBoundingClientRect().top;
        description.style.setProperty('--tooltip-top', `${offset}px`);
    };
    document.querySelectorAll<HTMLButtonElement>('.mode').forEach(button => {
        const describe = () => {
            if (describedButton !== button) {
                text.textContent = button.dataset.description!;
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    text.getAnimations().forEach(animation => animation.cancel());
                    text.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
                }
            }
            describedButton = button;
            position();
            description.classList.add('visible');
            description.setAttribute('aria-hidden', 'false');
        };
        button.addEventListener('pointerenter', describe, { signal });
        button.addEventListener('focus', describe, { signal });
    });
    panel.addEventListener('pointerleave', hide, { signal });
    panel.addEventListener('focusout', event => {
        if (!(event.relatedTarget instanceof Node) || !panel.contains(event.relatedTarget)) hide();
    }, { signal });
    window.addEventListener('resize', position, { signal });
    return hide;
}
