export class PlayerInputController {
    private isShooting = false;
    private mouseX = 0;
    private mouseY = 0;
    private events = new AbortController();

    constructor() {
        const options = { signal: this.events.signal };
        window.addEventListener('mousedown', (event) => {
            if (event.button === 0 && event.target instanceof HTMLCanvasElement) this.isShooting = true;
        }, options);
        window.addEventListener('mouseup', () => this.reset(), options);
        window.addEventListener('blur', () => this.reset(), options);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.reset();
        }, options);
        window.addEventListener('mousemove', (event) => {
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        }, options);
    }

    public getIsShooting(): boolean { return this.isShooting; }
    public getMousePosition() { return { x: this.mouseX, y: this.mouseY }; }
    public reset() { this.isShooting = false; }
    public dispose() { this.reset(); this.events.abort(); }
}
