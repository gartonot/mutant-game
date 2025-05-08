export class InputSystem {
    private keys: Set<string> = new Set();

    constructor() {
        window.addEventListener('blur', () => {
            this.keys.clear();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.keys.clear();
        });

        document.addEventListener('keydown', (e) => {
            this.keys.add(e.key);
        });
        document.addEventListener('keyup', (e) => {
            this.keys.delete(e.key);
        });
    }

    isPressed(key: string) {
        return this.keys.has(key);
    }
}
