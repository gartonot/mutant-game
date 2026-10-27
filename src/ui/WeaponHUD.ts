import { weaponHUDLayout, WEAPON_HUD_WIDTH as PANEL_WIDTH, WEAPON_HUD_HEIGHT as PANEL_HEIGHT } from './WeaponHUDLayout';
import type { IWeapon } from '@/entities/weapon/IWeapon';
import { drawWeapon } from '@/rendering/WeaponArt';
import { WEAPON_ART } from '@/rendering/WeaponGeometry';

const icons = new Map<string, HTMLCanvasElement>();


/** Cached category badges: ammunition updates never rebuild the artwork. */
function ammoIcon(index: number, empty: boolean): HTMLCanvasElement {
    const key = `${index}:${empty}`;
    const cached = icons.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
    const c = canvas.getContext('2d')!; c.scale(2, 2);
    const rect = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) => {
        c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
    };
    const rim = c.createLinearGradient(0,0,0,50);
    rim.addColorStop(0, empty ? '#b9bec0' : '#7e9166'); rim.addColorStop(.5,empty ? '#656b6d' : '#46593b'); rim.addColorStop(1,empty ? '#949a9d' : '#71835c');
    rect(1,1,48,48,8,'#23302a'); rect(3,3,44,44,6,rim);rect(6,6,38,38,4,'#858c78');
    const field = c.createLinearGradient(0,8,0,42);
    const colors = ['#394b32','#66532c','#355e5e','#455331','#334668'];
    field.addColorStop(0,empty?'#474b4c':colors[index]);field.addColorStop(1,empty?'#1c2022':'#183b23');
    rect(8,8,34,34,3,field);
    c.save(); c.translate(25,25);
    if(index === 0) {
        c.fillStyle='#eff2e8';c.font='bold 33px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('∞',0,-1);
    } else if(index === 1 || index === 2) {
        c.rotate(Math.PI / 4);
        for(let i=0;i<(index===1?2:3);i++) {
            const x=(i-(index===1?.5:1))*7;
            const g=c.createLinearGradient(x-3,0,x+3,0);
            g.addColorStop(0,empty?'#777d80':index===1?'#a36515':'#458f92');
            g.addColorStop(.45,empty?'#e1e5e6':index===1?'#c6ad6a':'#a4c1bf');
            g.addColorStop(1,empty?'#666d70':index===1?'#b67c23':'#5ea6ac');
            rect(x-2.5,-10,5,20,1,g);rect(x-3,7,6,3,.5,empty?'#b1b7ba':'#ad985e');
        }
    } else if(index === 3) {
        c.rotate(Math.PI/4);
        c.fillStyle=empty?'#d8dcdd':'#a1af7b';c.beginPath();c.moveTo(0,-16);c.lineTo(6,-5);c.lineTo(5,9);c.lineTo(-5,9);c.lineTo(-6,-5);c.closePath();c.fill();
        c.fillStyle=empty?'#848b8d':'#687d48';c.fillRect(-4,-2,8,10);
        c.beginPath();c.moveTo(-4,4);c.lineTo(-10,13);c.lineTo(0,10);c.lineTo(10,13);c.lineTo(4,4);c.fill();
    } else {
        const orb=c.createRadialGradient(-3,-4,1,0,0,12);
        orb.addColorStop(0,'#d1dce0');orb.addColorStop(.3,empty?'#dde1e2':'#a8bfcc');orb.addColorStop(.65,empty?'#949b9e':'#617d9a');orb.addColorStop(1,empty?'#41474c':'#203c86');
        c.fillStyle=orb;c.beginPath();c.arc(0,0,12,0,Math.PI*2);c.fill();
        c.strokeStyle=empty?'#b3b9bb':'#788d9d';c.lineWidth=2;c.beginPath();c.arc(0,0,16,-1,.8);c.stroke();
    }
    c.restore(); icons.set(key,canvas);return canvas;
}

function drawSelectedWeapon(ctx: CanvasRenderingContext2D, weapon: IWeapon): void {
    const center = weapon.id === 'pistol' ? 13.5 : weapon.id === 'plasma-grenade' ? 14 : (WEAPON_ART[weapon.id].muzzle - 14) / 2;
    ctx.save();
    ctx.translate(83, 35); ctx.scale(-1.8, 1.8); ctx.translate(-center, 0);
    drawWeapon(ctx, weapon.id);
    ctx.restore();
}
export function drawWeaponHUD(ctx: CanvasRenderingContext2D, weapons: readonly (IWeapon | null)[], selectedIndex: number): void {
    const selected=weapons[selectedIndex];if(!selected)return;
    const { x, y, scale } = weaponHUDLayout(window.innerWidth, window.innerHeight);
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    const panel=ctx.createLinearGradient(0,0,0,PANEL_HEIGHT);
    panel.addColorStop(0,'#60727b');panel.addColorStop(.12,'#879196');panel.addColorStop(.38,'#727e83');panel.addColorStop(.55,'#566369');panel.addColorStop(1,'#485760');
    ctx.fillStyle=panel;ctx.strokeStyle='#34444c';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(0,0,PANEL_WIDTH,PANEL_HEIGHT,[35,14,14,14]);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#a0adb440';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(4,4,PANEL_WIDTH-8,PANEL_HEIGHT-8,[31,10,10,10]);ctx.stroke();
    drawSelectedWeapon(ctx,selected);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 16px Arial';
    ctx.fillStyle='#f5f6f1';ctx.shadowColor='#18252e';ctx.shadowBlur=3;ctx.shadowOffsetY=1;
    ctx.fillText(selected.name,83,77,153);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    weapons.forEach((weapon,index)=>{
        const left=169+index*56;
        const ammo=weapon?.state.ammoRemaining??0;
        if(index===selectedIndex) {
            ctx.fillStyle='#edd937';ctx.beginPath();ctx.roundRect(left-3,5,55,85,5);ctx.fill();
            ctx.strokeStyle='#edd937';ctx.lineWidth=1;ctx.stroke();
        }
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 19px Arial';
        const label=ammo===Infinity?'∞':String(ammo);
        ctx.lineWidth=3;ctx.strokeStyle=index===selectedIndex?'#4d4525':'#465257';ctx.strokeText(label,left+24,21);
        ctx.fillStyle='#e1dfcf';ctx.fillText(label,left+24,21);
        ctx.drawImage(ammoIcon(index,ammo===0),left,37,49,49);
    });
    ctx.restore();
}

