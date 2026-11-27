import {AssetLibrary as Base,parsePack} from '../encounter-test/assets.js';
export {parsePack,calibrate,equipment} from '../encounter-test/assets.js';
// Extra stock armor/effect inputs are bundled into one download; accepted media stay shared.
export class AssetLibrary extends Base {
 constructor(catalog){super(catalog);this.extraImages=new Map();this.extraModels=new Map();this.effects=null;}
 static async create(){const base=await Base.create(),library=new AssetLibrary(base.catalog);await library.loadEffects();return library;}
 async loadEffects(){const r=await fetch(new URL('assets/effects.bin.gz',import.meta.url),{signal:this.controller.signal});if(!r.ok)throw new Error('Stock effects pack unavailable');const raw=new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()),d=new DataView(raw.buffer);if(String.fromCharCode(...raw.subarray(0,4))!=='EGFX')throw new Error('Invalid effects pack');const n=d.getUint32(4,true),bytes=d.getUint32(8,true);if(12+n+bytes!==raw.length)throw new Error('Truncated effects pack');const meta=JSON.parse(new TextDecoder().decode(raw.subarray(12,12+n)));if(meta.version!==1||meta.entries.length>128)throw new Error('Unsupported effects pack');const start=12+n;
  await Promise.all(meta.entries.map(async e=>{if(e.offset<0||e.bytes<0||e.offset+e.bytes>bytes)throw new Error('Invalid effect entry');const data=raw.slice(start+e.offset,start+e.offset+e.bytes),digest=await crypto.subtle.digest('SHA-256',data),hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==e.sha256)throw new Error('Effects integrity failure');if(e.key.startsWith('armor-')){const a=parsePack(data.buffer);a.key=e.key;this.extraModels.set(e.key,a);}else{const bitmap=await createImageBitmap(new Blob([data],{type:'image/png'}));if(this.disposed){bitmap.close();return;}this.extraImages.set(e.key,bitmap);}}));this.effects=meta;
 }
 snapshot(){return {...super.snapshot(),stockArmor:this.extraModels.size,effectTextures:this.extraImages.size};}
 destroy(){super.destroy();for(const b of this.extraImages.values())b.close();this.extraImages.clear();this.extraModels.clear();}
}
