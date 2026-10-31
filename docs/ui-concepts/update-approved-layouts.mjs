import fs from 'node:fs/promises';
import sharp from 'sharp';
const out='docs/ui-concepts';
const names=['arsenal-final','arsenal-bonuses-final','arsenal-weapons-final','arsenal-implants-final'];
for(const name of names){let svg=await fs.readFile(`${out}/${name}.svg`,'utf8');
svg=svg.replace(/<path d="M776 0H1132[^>]*\/>/g,'').replace(/<text x="829" y="54"[^>]*>УЛУЧШЕНИЯ<\/text>/g,'');
if(name!=='character-select-final'){
const gradient='<defs><linearGradient id="approvedStatsFade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#1b2b24"/><stop offset=".4" stop-color="#182720"/><stop offset="1" stop-color="#101b1a"/></linearGradient></defs>';
if(!svg.includes('id="approvedStatsFade"'))svg=svg.replace('<rect x="0" y="95" width="460" height="821" fill="#15211e"',gradient+'<rect x="0" y="95" width="460" height="821" fill="url(#approvedStatsFade)"');
}
svg=svg.replace(/<linearGradient id="approvedStatsFade"[^>]*>[\s\S]*?<\/linearGradient>/,'<linearGradient id="approvedStatsFade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#294232"/><stop offset=".35" stop-color="#21372b"/><stop offset=".7" stop-color="#17281f"/><stop offset="1" stop-color="#101b1a"/></linearGradient>');
svg=svg.replace('<rect x="460" y="95" width="1460" height="821" fill="#040708" opacity=".35"/>','<defs><linearGradient id="smoothDrawerDim" gradientUnits="userSpaceOnUse" x1="0" x2="1920"><stop offset="0" stop-color="#040708" stop-opacity="0"/><stop offset=".18" stop-color="#040708" stop-opacity="0"/><stop offset=".34" stop-color="#040708" stop-opacity=".35"/><stop offset="1" stop-color="#040708" stop-opacity=".35"/></linearGradient></defs><rect x="0" y="95" width="1920" height="821" fill="url(#smoothDrawerDim)"/>');
await fs.writeFile(`${out}/${name}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${out}/${name}.png`);
if(/<text x="829" y="54"[^>]*>УЛУЧШЕНИЯ/.test(svg))throw Error('Navigation not removed');
console.log(name+': updated');}
