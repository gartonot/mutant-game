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
            this.keys.add(e.code);
        });
        document.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });
    }

    isPressed(code: string) {
        return this.keys.has(code);
    }
}
