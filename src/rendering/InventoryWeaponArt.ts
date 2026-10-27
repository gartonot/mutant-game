import { weaponSpriteInventoryIcon, weaponSpritesReady } from './WeaponSprites';
import type { WeaponId } from '@/gameplay/ids';
import { drawExperimentalWeapon } from './ExperimentalWeaponArt';

const cache = new Map<WeaponId, string>();
/** Detailed side-view inventory illustrations. Combat art keeps its top-down pose. */
export function inventoryWeaponIcon(id: WeaponId): string {
    const sprite = weaponSpriteInventoryIcon(id);
    if (sprite) return sprite;
    const cached = cache.get(id);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 380;
    const c = canvas.getContext('2d')!;
    c.save();
    c.translate(120, 190); c.rotate(-Math.PI * .59); c.scale(4.4, 4.4); c.translate(-16, 0);
    const experimental = drawExperimentalWeapon(c, id);
    c.restore();
    if (experimental) {
        const url = canvas.toDataURL(); cache.set(id, url); return url;
    }
    c.translate(120, 190); c.rotate(-Math.PI * .59); c.scale(3.7, 3.7);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = .75;
    const gradient = (y: number, h: number, colors: string[]) => {
        const g = c.createLinearGradient(0,y,0,y+h);
        colors.forEach((color,i) => g.addColorStop(i/(colors.length-1),color)); return g;
    };
    const steel = gradient(-9,18,['#283039','#b9c3c9','#65737d','#252e36']);
    const dark = gradient(-8,17,['#1a232a','#65717b','#303b45','#11191f']);
    const silver = gradient(-10,20,['#5b6877','#e4eaf0','#9aa8b9','#374654']);
    const wood = gradient(-5,22,['#33251c','#956344','#68402d','#32271f']);
    const green = gradient(-9,20,['#193f27','#6ea459','#347247','#193b31']);
    const poly = (points: number[][], fill: string | CanvasGradient, outline = '#172027') => {
        c.fillStyle=fill; c.strokeStyle=outline; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath(); c.fill(); c.stroke();
    };
    const box = (x:number,y:number,w:number,h:number,fill:string|CanvasGradient,r=1) => {
        c.fillStyle=fill; c.strokeStyle='#202a32'; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); c.stroke();
    };
    const line = (points:number[][],color:string,width=1) => { c.strokeStyle=color; c.lineWidth=width; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.stroke(); c.lineWidth=.75; };
    const screw = (x:number,y:number) => { c.fillStyle='#c3cbd0';c.beginPath();c.arc(x,y,.7,0,Math.PI*2);c.fill();line([[x-.4,y],[x+.4,y]],'#2a333b',.35); };
    const ribs = (x:number,y:number,count:number,h:number) => { for(let i=0;i<count;i++) { line([[x+i*2,y],[x+i*2,y+h]],'#111b24',.8);line([[x+i*2+.6,y],[x+i*2+.6,y+h]],'#89979d',.35); } };
    const grip = (fill:string|CanvasGradient=dark) => { poly([[-14,3],[-6,4],[-10,19],[-17,16]],fill); ribs(-15,8,3,6); };
    const trigger = () => { line([[-8,6],[1,7],[0,13],[-9,12]],'#202b33',1.6);line([[-3,7],[-4,10]],'#a7b1b6',.9); };
    const glow = (x:number,y:number,w:number,h:number,color:string) => { c.save();c.shadowColor=color;c.shadowBlur=5;box(x,y,w,h,color,1);c.restore();line([[x+1,y+1],[x+w-1,y+1]],'#e2f8ff',.65); };
    const stock = (fill:string|CanvasGradient) => poly([[-34,-3],[-17,-4],[-11,0],[-14,6],[-23,6],[-32,10],[-35,8]],fill);
    c.save();c.shadowColor='#0009';c.shadowBlur=2;c.shadowOffsetX=1;c.shadowOffsetY=1;
    if (['rifle','m16','ak47'].includes(id)) {
        stock(id==='ak47'?wood:dark);grip(id==='ak47'?wood:dark);trigger();
        poly([[0,4],[8,4],[10,17],[5,23],[-1,22],[2,15]],dark);
        line([[4,8],[6,17],[3,20]],'#87949d',.8);
        box(12,-3,29,3,steel);box(39,-4,4,5,dark);box(32,-6,2,4,dark);
        box(-16,-6,31,11,steel,1.5);box(10,-5,18,9,id==='ak47'?wood:dark,1.6);ribs(12,-4,7,6);
        line([[-14,-4],[9,-4]],'#d0d7d8',.6);box(-12,-3,11,3,dark);screw(-13,2);screw(8,2);
        if(id==='m16') { line([[-12,-6],[-11,-11],[5,-11],[7,-6]],'#323e47',2);line([[-10,-10],[4,-10]],'#b9c2c8',.65); }
        else if(id==='rifle') { box(-3,-8,9,2,steel);box(24,-5,2,8,steel); }
        else { line([[2,-7],[11,-7]],'#a5afb3',1.5); }
    } else if(id==='shotgun'||id==='double-barrel') {
        stock(wood);poly([[-19,0],[-8,1],[-14,14],[-23,12]],wood);trigger();
        box(-12,-6,52,3.5,steel);box(-10,-1,49,3,steel);box(-16,-5,19,10,dark,1.2);
        if(id==='shotgun') {box(5,-2,17,7,wood,1.5);ribs(7,-1,7,5);}
        else {box(-2,-5,42,4,silver);box(-2,0,42,4,steel);box(-4,-6,7,11,dark);}
        box(39,-6,2,10,dark);line([[0,-5],[38,-5]],'#e0e6e9',.5);screw(-10,1);
    } else if(id==='machine-gun') {
        stock(dark);grip();trigger();box(-19,-8,25,17,dark,3);box(-11,7,18,10,wood,2);
        for(let y=-7;y<=5;y+=4) {box(3,y,39,3,steel);line([[5,y+.7],[40,y+.7]],'#d0d7dc',.65);}
        box(8,-10,4,21,dark);box(35,-10,5,21,steel);box(41,-9,3,19,dark);
        for(let x=-15;x<0;x+=4)screw(x,-5);
        box(-5,-12,14,3,dark);line([[-4,-11],[7,-11]],'#aeb8bf',.6);
    } else if(id==='plasma-grenade') {
        const ball=c.createRadialGradient(5,-6,1,0,0,18);ball.addColorStop(0,'#ffffff');ball.addColorStop(.3,'#e2e7f4');ball.addColorStop(.65,'#9ca9bf');ball.addColorStop(1,'#354459');
        c.fillStyle=ball;c.beginPath();c.arc(0,0,16,0,Math.PI*2);c.fill();c.strokeStyle='#313c51';c.stroke();
        c.save();c.beginPath();c.arc(0,0,16,0,Math.PI*2);c.clip();box(-4,-18,7,36,dark);glow(-1,-17,2,34,'#c3d5ff');c.restore();
        line([[-14,-6],[-10,-11],[-5,-14]],'#f4f7ff',1.5);
    } else if(id==='plasma-auto') {
        // Narrow rail housing, blue barrel insert, side-mounted energy magazine and open stock.
        poly([[-34,-5],[-19,-6],[-10,-2],[-12,6],[-24,5],[-30,11],[-35,9]],dark);
        grip(dark);trigger();
        line([[-29,-5],[-26,-14],[8,-14],[17,-8]],'#202c34',3.8);
        line([[-29,-5],[-26,-14],[8,-14],[17,-8]],'#819096',1.1);
        box(-17,-7,39,13,dark,2);
        box(13,-6,29,11,steel,2);box(38,-7,5,13,dark,1.5);
        box(19,-5,19,8,dark);glow(20,-3,16,3,'#739bff');
        line([[15,-6],[39,-6]],'#c0cbd3',.8);
        box(-8,5,12,15,dark,1.5);box(-6,8,8,10,steel);
        for(let x=-5;x<2;x+=2)glow(x,9,1,8,'#6d8bdf');
        box(1,-5,10,9,steel);ribs(2,-4,4,7);
        box(-21,-4,8,8,steel);line([[-18,-3],[-5,-3]],'#889aa9',.8);
        screw(-13,2);screw(11,2);screw(40,2);
    } else if(id==='flamethrower') {
        grip(green);trigger();box(-21,-5,48,10,steel,3);box(-19,-12,27,10,green,5);box(7,-11,4,9,steel);
        box(24,-3,18,4,steel);box(38,-5,5,8,dark);box(-25,-10,7,19,silver,3);
        line([[-21,6],[-24,14],[-7,19],[14,10],[16,3]],'#18241f',3.5);line([[-21,6],[-24,14],[-7,19],[14,10],[16,3]],'#8d9b8c',1.2);
        screw(-17,-8);box(13,-5,6,10,green);
    } else if(id==='skull-launcher') {
        stock(green);grip(green);trigger();poly([[-22,-7],[26,-7],[32,5],[19,11],[-21,8]],green);
        box(25,-3,16,8,steel);line([[-21,7],[22,7]],'#c9a951',1.5);
        for(const x of [-15,0,15]) { const bone=gradient(-12,17,['#faf5d9','#9eaa98','#555d55']);
            c.fillStyle=bone;c.strokeStyle='#26372a';c.beginPath();c.ellipse(x,-4,6,8,.1,0,Math.PI*2);c.fill();c.stroke();
            box(x+1,-6,3,2.8,'#241e18');box(x+1,-1,3,2.8,'#38261a');glow(x+2,-5,1,1,'#ffb833');line([[x+4,3],[x,4]],'#d8d4b9',1.3); }
    } else if(id==='grenade-launcher') {
        grip(green);trigger();stock(green);box(-23,-9,58,18,green,4);box(-26,-11,7,22,steel,2);box(30,-12,11,24,steel,2);box(39,-9,3,18,dark);
        box(-6,-11,5,22,steel);box(15,-11,4,22,steel);box(0,-14,18,3,dark);line([[-18,-7],[27,-7]],'#b4bf86',.7);
    } else {
        const plasma=id==='plasma-cannon', laser=id==='laser';
        stock(dark);grip(laser?green:dark);trigger();
        poly([[-24,-7],[-15,-12],[20,-12],[28,-6],[32,8],[10,13],[-23,8]],plasma?silver:dark);
        box(-20,-10,39,7,steel,2);box(-18,4,36,7,steel,2);
        glow(-17,-8,32,3,laser?'#ff8739':'#86b6ff');glow(-15,6,29,3,laser?'#ffca49':'#699aff');
        box(15,-8,7,19,silver,2);box(23,-5,18,12,steel,2);box(37,-7,5,16,silver,1.5);box(41,-3,3,8,dark);
        box(-14,-1,19,4,plasma?steel:green);ribs(-11,0,7,2);screw(-21,2);screw(18,2);
        line([[-19,11],[-13,17],[11,17],[25,9]],'#273741',2.5);line([[-19,11],[-13,17],[11,17],[25,9]],'#b5c3d0',.7);
        if(plasma) {box(-23,-14,31,3,silver);glow(-19,-13,23,1.5,'#709cff');}
    }
    c.restore();
    const url=canvas.toDataURL();cache.set(id,url);return url;
}

/** Refresh existing images in place: loading never resets focus or equipment selection. */
export function refreshWeaponIconsWhenReady(root: HTMLElement): void {
    void weaponSpritesReady().then(() => {
        root.querySelectorAll<HTMLImageElement>('img[data-weapon-art]').forEach(img => {
            img.src = inventoryWeaponIcon(img.dataset.weaponArt as WeaponId);
        });
    });
}
