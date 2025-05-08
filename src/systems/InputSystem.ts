export class InputSystem {
    private keys: Set<string> = new Set();

    constructor() {
        window.addEventListener('keydown', (e) => this.keys.add(e.key));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    }

    isPressed(key: string) {
        return this.keys.has(key);
    }
}
