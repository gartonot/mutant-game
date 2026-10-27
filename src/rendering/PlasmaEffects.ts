/** White plasma effects share a cached soft sprite; no particle objects or timers are allocated. */
let glowSprite: HTMLCanvasElement | undefined;
let beamStart: HTMLCanvasElement | undefined;
function haloGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    const halo=ctx.createLinearGradient(0,-90,0,90);
    halo.addColorStop(0,'#dff9ff00');halo.addColorStop(.2,'#e5faff12');halo.addColorStop(.36,'#efffff55');
    halo.addColorStop(.5,'#ffffffd9');halo.addColorStop(.64,'#efffff55');halo.addColorStop(.8,'#e5faff12');halo.addColorStop(1,'#dff9ff00');
    return halo;
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number): void {
    if (!glowSprite) {
        glowSprite = document.createElement('canvas'); glowSprite.width = glowSprite.height = 128;
        const c = glowSprite.getContext('2d')!;
        const gradient = c.createRadialGradient(64,64,0,64,64,64);
        gradient.addColorStop(0,'#ffffff'); gradient.addColorStop(.13,'#ffffffed');
        gradient.addColorStop(.35,'#efffff80'); gradient.addColorStop(.65,'#dff8ff25'); gradient.addColorStop(1,'#dff8ff00');
        c.fillStyle=gradient;c.fillRect(0,0,128,128);
    }
    ctx.globalAlpha=alpha;ctx.drawImage(glowSprite,x-radius,y-radius,radius*2,radius*2);
}

export function drawPlasmaCharge(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
    const p=Math.max(0,Math.min(1,progress));
    if (!p) return;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    glow(ctx,x,y,24+70*p*p,.15+.65*p*p);
    // Staggered inward flights accelerate towards the muzzle; trails point away from it.
    for(let i=0;i<36;i++) {
        const start=(i/36)*.82;
        const duration=.28+(i%5)*.026;
        const t=(p-start)/duration;
        if(t<=0||t>=1)continue;
        const angle=i*2.399963+Math.sin(i*1.7)*.25;
        const distance=48+(i%7)*7;
        const radius=distance*(1-t*t);
        const tailT=Math.max(0,t-.055-.07*t);
        const tailRadius=distance*(1-tailT*tailT);
        const a=angle+.22*(1-t), tailAngle=angle+.22*(1-tailT);
        const px=x+Math.cos(a)*radius, py=y+Math.sin(a)*radius;
        const alpha=Math.min(1,t*7)*(1-t*.4)*(.45+.55*p);
        ctx.globalAlpha=alpha;ctx.strokeStyle='#f5ffff';ctx.lineWidth=.7+(i%3)*.4;
        ctx.beginPath();ctx.moveTo(x+Math.cos(tailAngle)*tailRadius,y+Math.sin(tailAngle)*tailRadius);ctx.lineTo(px,py);ctx.stroke();
        glow(ctx,px,py,3.5+(i%3),alpha*.8);
        ctx.globalAlpha=alpha;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,1+(i%3)*.35,0,Math.PI*2);ctx.fill();
    }
    glow(ctx,x,y,13+30*p*p,.4+.6*p);
    ctx.globalAlpha=.5+.5*p;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,2+9*p*p*p,0,Math.PI*2);ctx.fill();
    ctx.restore();
}

export function drawPlasmaBeam(ctx: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number, ageMs: number): void {
    const strength=Math.max(0,1-Math.max(0,ageMs-30)/160);
    if(!strength)return;
    const length=Math.hypot(endX-x,endY-y);
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(endY-y,endX-x));ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=strength;
    // Soft cross-section instead of several hard-edged parallel stripes.
    if (!beamStart) {
        beamStart=document.createElement('canvas');beamStart.width=128;beamStart.height=180;
        const c=beamStart.getContext('2d')!;c.translate(0,90);c.fillStyle=haloGradient(c);c.fillRect(0,-90,128,180);
        c.globalCompositeOperation='destination-in';
        const fade=c.createLinearGradient(0,0,128,0);fade.addColorStop(0,'#ffffff00');fade.addColorStop(1,'#ffffff');
        c.fillStyle=fade;c.fillRect(0,-90,128,180);
    }
    ctx.drawImage(beamStart,-60,-90,120,180);
    ctx.fillStyle=haloGradient(ctx);ctx.fillRect(60,-90,Math.max(0,length-60),180);
    const core=ctx.createLinearGradient(0,-26,0,26);
    core.addColorStop(0,'#ffffff00');core.addColorStop(.15,'#ffffffc0');core.addColorStop(.3,'#fff');core.addColorStop(.7,'#fff');core.addColorStop(.85,'#ffffffc0');core.addColorStop(1,'#ffffff00');
    ctx.fillStyle=core;ctx.fillRect(0,-26,length,52);
    glow(ctx,0,0,85,strength);glow(ctx,14,0,45,strength);
    ctx.globalAlpha=strength;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(8,0,19,21,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
}
