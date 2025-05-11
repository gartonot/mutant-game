export class PlayerInputController {
    private isShooting = false;
    private mouseX = 0;
    private mouseY = 0;

    constructor() {
        window.addEventListener('mousedown', () => this.isShooting = true);
        window.addEventListener('mouseup', () => this.isShooting = false);
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
    }

    public getIsShooting(): boolean {
        return this.isShooting;
    }

    public getMousePosition(): { x: number; y: number } {
        return { x: this.mouseX, y: this.mouseY };
    }
}
