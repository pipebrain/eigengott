// Small original economy: equipped items only, one fragment per item.
export const SLOTS=['helmet','torso','legs'];
export const ARMOR={
 'visor':{slot:'helmet',name:'Open visor',defense:8,mobility:1,color:[.52,.62,.58],radius:0,height:0},
 'bastion':{slot:'helmet',name:'Bastion helmet',defense:20,mobility:.88,color:[.64,.53,.32],radius:.025,height:.045},
 'vest':{slot:'torso',name:'Light vest',defense:12,mobility:1,color:[.37,.48,.45],radius:0,height:0},
 'plate':{slot:'torso',name:'Heavy cuirass',defense:32,mobility:.8,color:[.48,.43,.32],radius:.045,height:0},
 'greaves':{slot:'legs',name:'Light greaves',defense:8,mobility:1,color:[.44,.49,.48],radius:0,height:0},
 'siege':{slot:'legs',name:'Siege greaves',defense:22,mobility:.85,color:[.55,.48,.35],radius:.025,height:0},
};
export const MODS={
 focus:{name:'Focus fragment',slot:'weapon',description:'Tighter firing pattern; slower attack cycle.',damage:1,delay:1.15,spread:.45,color:[.53,.74,.72]},
 surge:{name:'Surge fragment',slot:'weapon',description:'Harder hits; slower attack cycle.',damage:1.3,delay:1.25,spread:1,color:[.75,.57,.38]},
 thermal:{name:'Thermal fragment',slot:'helmet',description:'Heat silhouettes in darkness. Cold architecture stays dark.',defense:0,mobility:1,color:[.84,.45,.22]},
 ward:{name:'Ward fragment',slot:'armor',description:'More protection; greater movement resistance.',defense:10,mobility:.95,color:[.47,.65,.58]},
 light:{name:'Light-frame fragment',slot:'armor',description:'Easier movement; less protection.',defense:-5,mobility:1.1,color:[.6,.66,.72]},
};
export const compatible=(item,mod)=>!mod||!!MODS[mod]&&(MODS[mod].slot==='weapon'?item.kind==='weapon':MODS[mod].slot==='helmet'?item.slot==='helmet':item.kind==='armor');
export function startingLoadout(){return {weapon:{kind:'weapon',weapon:2,mod:null},helmet:{kind:'armor',slot:'helmet',armor:'visor',mod:null,condition:1},torso:{kind:'armor',slot:'torso',armor:'vest',mod:null,condition:1},legs:{kind:'armor',slot:'legs',armor:'greaves',mod:null,condition:1}};}
export const clone=x=>JSON.parse(JSON.stringify(x));
export function sanitizeLoadout(x){const d=startingLoadout();for(const slot of ['weapon',...SLOTS]){const a=x?.[slot];if(!a)continue;if(slot==='weapon'&&Number.isInteger(a.weapon)&&a.weapon>=1&&a.weapon<=13)d.weapon={kind:'weapon',weapon:a.weapon,mod:compatible({kind:'weapon'},a.mod)?a.mod:null,quality:Math.max(0,Math.min(1000000,Math.trunc(a.quality)||0))};if(SLOTS.includes(slot)&&ARMOR[a.armor]?.slot===slot)d[slot]={kind:'armor',slot,armor:a.armor,mod:compatible({kind:'armor',slot},a.mod)?a.mod:null,quality:Math.max(0,Math.min(1000000,Math.trunc(a.quality)||0)),condition:Number.isFinite(a.condition)?Math.max(0,Math.min(1,a.condition)):1};}for(const slot of ['weapon',...SLOTS])if(!d[slot].quality)delete d[slot].quality;return d;}
export function traits(loadout){let defense=0,mobility=1,radius=0,height=0,color=[0,0,0],thermal=false;for(const s of SLOTS){const item=loadout[s],a=ARMOR[item.armor],m=MODS[item.mod];defense+=Math.max(0,a.defense+Math.log2(1+(item.quality||0))*4+(m?.defense||0))*item.condition;mobility*=a.mobility*(m?.mobility||1);radius=Math.max(radius,a.radius);height=Math.max(height,a.height);a.color.forEach((c,i)=>color[i]+=c/3);if(s==='helmet'&&item.mod==='thermal'&&item.condition>0)thermal=true;}return {defense,mobility:Math.max(.5,Math.min(1.15,mobility)),radius,height,color,thermal,condition:SLOTS.reduce((n,s)=>n+loadout[s].condition,0)/3};}
export function generatedLoadout(index){const a=startingLoadout(),guns=[2,3,8];a.weapon={kind:'weapon',weapon:guns[index%3],mod:index%2?'surge':'focus'};a.helmet={kind:'armor',slot:'helmet',armor:index%2?'bastion':'visor',mod:index%3===0?'thermal':'ward',condition:1};a.torso={kind:'armor',slot:'torso',armor:index%2?'plate':'vest',mod:index%3===1?'light':'ward',condition:1};a.legs={kind:'armor',slot:'legs',armor:index%2?'siege':'greaves',mod:null,condition:1};return a;}
export function itemName(item,weapons){return item.kind==='weapon'?weapons[item.weapon].name:item.kind==='mod'?MODS[item.mod].name:ARMOR[item.armor].name;}
export function describe(item,weapons){if(item.kind==='mod')return MODS[item.mod].description;if(item.kind==='weapon'){const w=weapons[item.weapon],m=MODS[item.mod];return `${w.kind} · ${m?.name||'No fragment'}${m?' · '+m.description:''}`;}const a=ARMOR[item.armor];return `${a.defense>=20?'Heavy protection':'Light protection'} · ${a.mobility<1?'Reduced mobility':'Free movement'} · ${item.condition>.7?'Intact':item.condition>.3?'Worn':'Failing'} · ${MODS[item.mod]?.name||'No fragment'}`;}
