import { weaponHUDLayout, WEAPON_HUD_WIDTH as PANEL_WIDTH, WEAPON_HUD_HEIGHT as PANEL_HEIGHT } from './WeaponHUDLayout';
import type { IWeapon } from '@/entities/weapon/IWeapon';
import { drawWeapon } from '@/rendering/WeaponArt';
import { WEAPON_ART } from '@/rendering/WeaponGeometry';
import { ammoImage } from '@/rendering/AmmoArt';

const icons = new Map<string, HTMLCanvasElement>();
const ammoCategories = ['infinite', 'shotgun', 'automatic', 'special', 'scientific'] as const;

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
    const colors = ['#394b32','#66532c','#355e5e','#455331','#334668'];
    const field = c.createLinearGradient(0,8,0,42);
    field.addColorStop(0,empty?'#474b4c':colors[index]);field.addColorStop(1,empty?'#1c2022':'#183b23');
    rect(8,8,34,34,3,field);
    const asset = ammoImage(ammoCategories[index]);
    if (asset?.loaded) {
        c.save();
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        if (empty) c.filter = 'grayscale(1) brightness(0.8)';
        c.drawImage(asset.image, 9, 9, 32, 32);
        c.restore();
        icons.set(key, canvas);
    }
    // Do not cache a frame without its artwork while the image is still loading.
    return canvas;
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
        const label=ammo===Infinity?'':String(ammo);
        ctx.lineWidth=3;ctx.strokeStyle=index===selectedIndex?'#4d4525':'#465257';ctx.strokeText(label,left+24,21);
        ctx.fillStyle='#e1dfcf';ctx.fillText(label,left+24,21);
        ctx.drawImage(ammoIcon(index,ammo===0),left,37,49,49);
    });
    ctx.restore();
}

