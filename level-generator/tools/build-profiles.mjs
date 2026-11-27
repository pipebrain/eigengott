import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
const root=new URL('../../',import.meta.url),{parsePack,calibrate,equipment}=await import(new URL('playable-test/assets.js',root));
const hash=b=>createHash('sha256').update(b).digest('hex'),catalog=JSON.parse(await readFile(new URL('encounter-test/assets/catalog.json',root)));
async function load(file){const b=gunzipSync(await readFile(new URL('encounter-test/assets/'+file,root)));return parsePack(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const weapon=await load(catalog.weapons.find(w=>w.id===2).file),profiles=[];
for(const c of catalog.characters){const a=calibrate(await load(c.file)),gear=equipment(a,weapon);profiles.push({id:c.id,radius:a.body.radius+.105,height:a.body.height+.045,gear});}
const radius=Math.max(...profiles.map(p=>Math.max(p.radius,Math.hypot(p.gear.right,Math.max(Math.abs(p.gear.start),Math.abs(p.gear.length)))+p.gear.gunRadius))),height=Math.max(...profiles.map(p=>p.height));
const data={version:1,profiles,composite:{id:'all-18-navigation-plus-machinegun',radius,height,eye:1.75},scope:'Current 18 model navigation allowances and a yaw-rotating machinegun envelope at level pitch. No all-weapon, crouch/jump-only or vertical-aim traversal claim.'};
data.hash=hash(JSON.stringify(data));await writeFile(new URL('../profiles.json',import.meta.url),JSON.stringify(data,null,2)+'\n');console.log(data.composite);
