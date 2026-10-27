export class InputSystem {
    private keys: Set<string> = new Set();
    private events = new AbortController();

    constructor() {
        const options = { signal: this.events.signal };
        window.addEventListener('blur', () => this.reset(), options);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.reset();
        }, options);
        document.addEventListener('keydown', (event) => this.keys.add(event.code), options);
        document.addEventListener('keyup', (event) => this.keys.delete(event.code), options);
    }

    isPressed(code: string) { return this.keys.has(code); }
    reset() { this.keys.clear(); }
    dispose() { this.reset(); this.events.abort(); }
}
