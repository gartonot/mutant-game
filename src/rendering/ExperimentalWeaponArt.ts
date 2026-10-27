import type { WeaponId } from '@/gameplay/ids';

/** Original vector models: +X is forward, trigger at (4,1), muzzle on Y=0. */
export function drawExperimentalWeapon(c: CanvasRenderingContext2D, id: WeaponId): boolean {
    if (!['tesla', 'impulse', 'acid-gun', 'crossbow', 'disc-launcher'].includes(id)) return false;
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = .8;
    const gradient = (colors: string[]) => {
        const g = c.createLinearGradient(0, -11, 0, 11);
        colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
        return g;
    };
    const steel = gradient(['#e1e8e8', '#7e929d', '#394b59', '#1e2c36']);
    const dark = gradient(['#71828b', '#33444d', '#1a252e']);
    const green = gradient(['#9fdf76', '#468636', '#1b482b']);
    const box = (x: number, y: number, w: number, h: number, fill: string | CanvasGradient, r = 1) => {
        c.fillStyle = fill; c.strokeStyle = '#111e25';
        c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.stroke();
    };
    const path = (points: number[][], color: string, width: number) => {
        c.strokeStyle = color; c.lineWidth = width; c.beginPath();
        points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.stroke(); c.lineWidth = .8;
    };
    const poly = (points: number[][], fill: string | CanvasGradient) => {
        c.fillStyle = fill; c.strokeStyle = '#13212a'; c.beginPath();
        points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.closePath(); c.fill(); c.stroke();
    };
    const circle = (x: number, y: number, r: number, fill: string | CanvasGradient) => {
        c.fillStyle = fill; c.strokeStyle = '#19262f'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    };
    const ribs = (start: number, end: number, y: number, height: number) => {
        for (let x = start; x < end; x += 2.5) path([[x, y], [x, y + height]], '#bcc8c9', .65);
    };
    const glow = (x: number, y: number, w: number, h: number, color: string) => {
        box(x, y, w, h, color); path([[x + 1, y + 1], [x + w - 1, y + 1]], '#e9ffff', .6);
    };
    // Broad central receiver lets both character hands contact the model.
    box(-14, -4, 19, 8, dark, 2); box(1, 2, 7, 7, dark);
    if (id === 'crossbow') {
        poly([[-14, -4], [2, -4], [8, 0], [0, 5], [-14, 6]], dark);
        box(0, -4, 46, 8, steel); box(8, -2, 36, 4, '#1a252b');
        ribs(4, 30, -4, 1.5);
        // Two swept limbs and a taut bowstring distinguish it from a firearm.
        path([[31, -15], [40, -12], [44, -6], [45, 0], [44, 6], [40, 12], [31, 15]], '#16212a', 4);
        path([[31, -15], [40, -12], [44, -6], [45, 0], [44, 6], [40, 12], [31, 15]], '#9eafb9', 1.7);
        path([[31, -15], [15, 0], [31, 15]], '#d8dcce', .6);
        path([[11, 0], [47, 0]], '#d6e1e1', 1);
        poly([[49, 0], [44, -2], [44, 2]], '#c8d8d8');
        poly([[12, 0], [9, -2], [15, -2]], '#85a0ab');
        box(14, 4, 16, 3, dark); ribs(16, 29, 4.5, 2);
    } else if (id === 'tesla') {
        path([[-5, -4], [-7, -12], [3, -16], [19, -14], [30, -7]], '#15252f', 4);
        path([[-5, -4], [-7, -12], [3, -16], [19, -14], [30, -7]], '#74a8f3', 2);
        box(-3, -7, 35, 14, steel, 2); box(4, -4, 19, 8, dark);
        ribs(6, 22, -3, 6); glow(24, -6, 5, 12, '#538ded');
        box(31, -4, 8, 8, dark); circle(39, 0, 4.5, '#639bfa'); circle(39, -1, 2, '#c6e8ff');
        path([[34, -4], [38, -9], [44, -8], [46, -3]], '#182a34', 3.5);
        path([[34, 4], [38, 9], [44, 8], [46, 3]], '#182a34', 3.5);
        path([[34, -4], [38, -9], [44, -8], [46, -3]], '#b5c8d3', 1.4);
        path([[34, 4], [38, 9], [44, 8], [46, 3]], '#b5c8d3', 1.4);
    } else if (id === 'impulse') {
        path([[2, 7], [6, 15], [31, 15], [35, 7]], '#23343c', 3);
        path([[2, 7], [6, 15], [31, 15], [35, 7]], '#9aacb4', 1);
        box(-5, -10, 44, 20, steel, 3); box(3, -8, 27, 16, '#19437b', 2);
        glow(6, -7, 21, 14, '#367ed6');
        path([[18, -6], [12, -1], [21, 0], [15, 6]], '#e5ffff', 1.7);
        box(-6, -11, 8, 22, steel); ribs(-4, 2, -9, 18);
        box(31, -11, 8, 22, steel); ribs(33, 39, -9, 18);
        for (const y of [-6, 0, 6]) poly([[39, y - 2], [46, y], [39, y + 2]], steel);
    } else if (id === 'acid-gun') {
        path([[1, -5], [2, -14], [18, -15], [31, -9]], '#1e3728', 4);
        path([[1, -5], [2, -14], [18, -15], [31, -9]], '#72d68b', 2);
        box(-4, -9, 38, 18, steel, 3); glow(1, -7, 27, 14, '#45d653');
        box(-5, -10, 6, 20, dark); box(28, -10, 6, 20, dark);
        path([[2, 6], [25, -6]], '#d2e9e0', 3.2); path([[2, 6], [25, -6]], '#657e80', 1);
        for (const [x, y, r] of [[7, -3, 1.5], [14, 3, 1], [22, -3, 1]]) circle(x, y, r, '#b4ff7c');
        box(34, -3, 10, 6, steel); box(43, -4, 3, 8, dark);
        glow(-11, -4, 6, 7, '#77d63d');
    } else {
        poly([[-11, -5], [5, -10], [25, -10], [39, -5], [40, 4], [18, 9], [-10, 6]], green);
        path([[-10, 5], [10, 4], [23, -3], [38, -3]], '#d1dde0', 4);
        path([[-10, 5], [10, 4], [23, -3], [38, -3]], '#677f8d', 1.1);
        // Exposed circular blade at the nose; orange bearing recalls the reference.
        circle(37, 0, 9, steel); circle(37, 0, 6.5, '#c8d5d9');
        for (let i = 0; i < 10; i++) {
            const a = i * Math.PI / 5;
            path([[37 + Math.cos(a) * 6, Math.sin(a) * 6], [37 + Math.cos(a + .22) * 8.5, Math.sin(a + .22) * 8.5]], '#4e6571', .8);
        }
        circle(37, 0, 3.3, '#d77630'); circle(37, -1, 1.4, '#ffcf6c');
        for (let x = 7; x < 25; x += 5) circle(x, -6, .8, '#172e21');
    }
    for (const x of [-2, 25]) circle(x, 3, .8, '#d3dfe1');
    c.restore(); return true;
}
