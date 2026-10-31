import sharp from 'sharp';import fs from 'node:fs/promises';
let s=[];const W=1920,H=1200;
const text=(x,y,v,size=20,c='#dce3df',weight=400)=>s.push(`<text x="${x}" y="${y}" font-family="Segoe UI,Arial" font-size="${size}" fill="${c}" font-weight="${weight}">${v.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`);
const rect=(x,y,w,h,fill,r=0,stroke='none')=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`);
const image=async(p,x,y,w,h,fit='contain',attrs='')=>{const b=await sharp(p).resize(w,h,{fit,position:'attention',background:'#00000000'}).png().toBuffer();s.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}" ${attrs}/>`)};
const para=(value,x,y,max=100,size=19,line=28,color='#a9b4b2')=>{let words=value.split(' '),row='',rows=[];for(const word of words){if((row+' '+word).trim().length>max){rows.push(row);row=word}else row=(row+' '+word).trim()}if(row)rows.push(row);rows.forEach((v,i)=>text(x,y+i*line,v,size,color));return y+rows.length*line;};
s.push(`<defs><linearGradient id="bg" x2="0.8" y2="1"><stop stop-color="#202b29"/><stop offset=".5" stop-color="#121b1d"/><stop offset="1" stop-color="#080f11"/></linearGradient><linearGradient id="nav" x2="0" y2="1"><stop stop-color="#30393b"/><stop offset=".12" stop-color="#1f272b"/><stop offset=".8" stop-color="#10171c"/><stop offset="1" stop-color="#090e12"/></linearGradient><linearGradient id="active" x2="0" y2="1"><stop stop-color="#3c4845"/><stop offset=".65" stop-color="#253830"/><stop offset="1" stop-color="#456040"/></linearGradient><linearGradient id="portraitFade"><stop offset="0" stop-color="white"/><stop offset=".48" stop-color="white"/><stop offset=".58" stop-color="#f1f1f1"/><stop offset=".68" stop-color="#c8c8c8"/><stop offset=".78" stop-color="#818181"/><stop offset=".88" stop-color="#303030"/><stop offset=".96" stop-color="#050505"/><stop offset="1" stop-color="black"/></linearGradient><linearGradient id="bottomFade" x2="0" y2="1"><stop offset=".68" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="pf"><rect width="760" height="880" fill="url(#portraitFade)"/></mask><mask id="bf"><rect width="760" height="880" fill="url(#bottomFade)"/></mask><radialGradient id="glow"><stop stop-color="#8fcb65" stop-opacity=".23"/><stop offset="1" stop-color="#8fcb65" stop-opacity="0"/></radialGradient><clipPath id="roster"><rect x="24" y="1003" width="1872" height="180"/></clipPath></defs>`);
rect(0,0,W,H,'url(#bg)');s.push('<ellipse cx="470" cy="450" rx="850" ry="560" fill="url(#glow)"/>');
s.push('<g transform="translate(0 95)" mask="url(#bf)"><g mask="url(#pf)">');await image('src/assets/portraits-runtime/full/destroyer.webp',0,0,760,880,'cover');s.push('</g></g>');
s.push('<defs><linearGradient id="silverNav" x2="0" y2="1"><stop stop-color="#a4abb0"/><stop offset=".035" stop-color="#646d75"/><stop offset=".16" stop-color="#505a63"/><stop offset=".48" stop-color="#363f48"/><stop offset=".52" stop-color="#303941"/><stop offset=".94" stop-color="#242c33"/><stop offset="1" stop-color="#707b83"/></linearGradient><linearGradient id="silverActive" x2="0" y2="1"><stop stop-color="#c8cdd0"/><stop offset=".04" stop-color="#8e989f"/><stop offset=".48" stop-color="#657079"/><stop offset=".52" stop-color="#535e67"/><stop offset="1" stop-color="#3c474f"/></linearGradient></defs>');
rect(0,0,1920,88,'url(#silverNav)');s.push('<path d="M0 88H1920" stroke="#8b969d" stroke-opacity=".6"/><path d="M153 4L130 84" stroke="#121a22"/><path d="M155 4L132 84" stroke="#a1aab0" stroke-opacity=".35"/>');text(51,64,'М',62,'#a2e16b',800);
const tabs=[['ПЕРСОНАЖ',178,490,true],['АРСЕНАЛ',490,776,false],['УЛУЧШЕНИЯ',776,1132,false]];
for(const[label,x,end,active]of tabs){s.push(`<path d="M${x} 0H${end}L${end-25} 86H${x-25}Z" fill="${active?'url(#silverActive)':'url(#silverNav)'}" stroke="#a4adb5" stroke-opacity=".28"/>`);text(x+53,54,label,25,active?'#f2f4f5':'#c1c7cc',700);if(active){s.push(`<path d="M${x-25} 86H${end-25}" stroke="#99d66a" stroke-width="2"/>`);}}
text(1600,50,'ПОДГОТОВКА К БОЮ',18,'#b5bfc6',600);text(1860,52,'×',30,'#c0c8ce');
text(778,169,'РАЗРУШИТЕЛЬ',54,'#f0f1df',700);text(782,204,'Тяжёлая поддержка',22,'#a7bd9e');
s.push('<g transform="translate(0 -32)">');rect(766,267,546,38,'url(#storyHeader)');text(782,294,'ОСОБЕННОСТИ',18,'#e4efd8',700);
s.push('<defs><linearGradient id="traitPositive"><stop stop-color="#366b35" stop-opacity=".55"/><stop offset="1" stop-color="#27452d" stop-opacity=".08"/></linearGradient><linearGradient id="traitNegative"><stop stop-color="#7b3836" stop-opacity=".5"/><stop offset="1" stop-color="#422c2b" stop-opacity=".08"/></linearGradient><linearGradient id="traitGear"><stop stop-color="#64714c" stop-opacity=".25"/><stop offset="1" stop-color="#29372c" stop-opacity=".04"/></linearGradient></defs>');
rect(782,310,520,34,'url(#traitGear)',4);text(798,334,'Базука · 5 стартовых патронов',18,'#c7ceba');
rect(782,348,520,38,'url(#traitPositive)',4);rect(782,348,3,38,'#8bcd67',1);text(798,374,'+50% к радиусу взрывов',21,'#c8e9ac',600);
rect(782,390,520,38,'url(#traitNegative)',4);rect(782,390,3,38,'#c37b6c',1);text(798,416,'−10% к скорости бега',21,'#e4b3a3',600);
await image('src/assets/abilities-runtime/destroyer.webp',782,440,72,72,'cover');text(872,463,'АКТИВНАЯ СПОСОБНОСТЬ',14,'#8ba08e',600);text(872,494,'Удар артиллерии',27,'#e4e8d8',600);
para('Множество взрывов накрывает весь экран. Каждый видимый враг получает 6 урона один раз.',782,531,54,19,27,'#b6c0b8');
text(795,601,'Активация:',17,'#aebfb0');rect(896,581,30,26,'#48534d',4,'#859180');rect(896,581,30,23,'#2d3932',4,'#859180');text(905,599,'F',17,'#e2ebd9',700);s.push('<path d="M944 584V604" stroke="#47574a"/>');s.push('<path d="M969.36 587.64A9 9 0 1 0 971.46 597.08" stroke="#a9c293" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M972.5 582.5V590.5H964.5Z" fill="#a9c293"/>');text(980,601,'60 сек.',17,'#c7d9b6',600);
rect(1346,267,530,38,'url(#storyHeader)');text(1362,294,'ХАРАКТЕРИСТИКИ',18,'#e4efd8',700);const stats=[['Здоровье','100 ХП'],['Скорость бега','×0,9'],['Скорость стрельбы','×1'],['Урон оружием','×1'],['Броня — снижение урона','0%'],['Радиус взрывов','×1,5'],['Регенерация','0 ХП/с'],['Время бонусов на земле','×1'],['Длительность бонусов','×1']];
for(let i=0;i<stats.length;i++){const yy=331+i*29;text(1362,yy,stats[i][0],18,'#abb8af');text(1783,yy,stats[i][1],19,i===5?'#b9dd97':'#d8e1d6',600);}

s.push('<defs><linearGradient id="storyHeader"><stop stop-color="#24883b" stop-opacity=".85"/><stop offset=".36" stop-color="#246b37" stop-opacity=".5"/><stop offset="1" stop-color="#182d22" stop-opacity="0"/></linearGradient></defs>');rect(766,630,1110,40,'url(#storyHeader)');text(782,658,'ИСТОРИЯ',18,'#e4efd8',700);
const source=await fs.readFile('src/ui/CharacterPresentations.ts','utf8');const section=source.slice(source.indexOf("id: 'destroyer' as const"),source.indexOf("id: 'assassin' as const"));const story=section.match(/story: \[([\s\S]*?)\]/)[1];const paragraphs=[...story.matchAll(/'([^']+)'/g)].map(v=>v[1]);let yy=690;for(const p of paragraphs)yy=para(p,782,yy,111,18,25,'#a4b2aa')+12;
s.push('</g>');rect(0,916,1920,73,'#0c1416');s.push('<path d="M24 916H1896" stroke="#405047"/>');
s.push('<path d="M1613 929H1890L1875 978H1598Z" fill="#759b50" stroke="#a5cc7c"/>');text(1683,962,'В БОЙ →',25,'#11200f',700);
rect(0,989,1920,211,'#090f12');rect(0,989,1920,35,'url(#silverNav)');text(25,1013,'ВЫБОР ПЕРСОНАЖА',15,'#edf0f2',700);
const roster=[['destroyer','Разрушитель'],['assassin','Убийца'],['mercenary','Наёмник'],['half-mutant','Полумутант'],['telepath','Телепат'],['cyborg','Киборг'],['goliath','Голиаф'],['fanatic','Фанатик'],['nuclear','Ядерщик'],['hunter','Охотник'],['silver-hunter','Серебряный охотник'],['witcher','Ведьмак'],['plasma-nuclear','Плазменный ядерщик'],['unknown-white-outfit-v1','Неизвестный'],['unknown-crossbow-v3','Неизвестная']];
s.push('<defs><linearGradient id="cardShade" x2="0" y2="1"><stop stop-color="#050a08" stop-opacity="0"/><stop offset=".4" stop-color="#050a08" stop-opacity=".5"/><stop offset="1" stop-color="#050a08" stop-opacity=".96"/></linearGradient><filter id="selectedGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>');
s.push('<g clip-path="url(#roster)">');for(let i=0;i<roster.length;i++){const[id,name]=roster[i],x=24+i*109,y=1041,w=97,h=133;
if(i===0)s.push(`<rect x="${x-1}" y="${y-1}" width="${w+2}" height="${h+2}" rx="8" fill="none" stroke="#8ae745" stroke-width="4" filter="url(#selectedGlow)"/>`);
s.push(`<clipPath id="card${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/></clipPath><g clip-path="url(#card${i})">`);
await image(`src/assets/portraits-runtime/thumbnail/${id}.webp`,x,y,w,h,'cover');rect(x,y+89,w,44,'url(#cardShade)');
const label=name==='Серебряный охотник'?['Серебряный','охотник']:name==='Плазменный ядерщик'?['Плазменный','ядерщик']:[name];
label.forEach((line,j)=>s.push(`<text x="${x+w/2}" y="${y+h-8-(label.length-1-j)*12}" text-anchor="middle" font-family="Segoe UI,Arial" font-size="11" font-weight="700" fill="#f0f2e5">${line}</text>`));
s.push('</g>');if(i===0)s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="#99e654" stroke-width="2"/>`);
}s.push('</g>');
rect(24,1191,1872,6,'#24312d',3);rect(24,1191,1480,6,'#718866',3);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${s.join('')}</svg>`;await fs.writeFile('docs/ui-concepts/character-select-v24.svg',svg);await sharp(Buffer.from(svg)).png().toFile('docs/ui-concepts/character-select-v24.png');
















