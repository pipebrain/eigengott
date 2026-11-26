// Bake the exact v1.0 reference-glyph distance fields once, using its own cache
// builder. Production has no Canvas/font rasterization or dependency on the lab.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {withBrowser} from './browser.mjs';
const root=new URL('../',import.meta.url);
await withBrowser(async({origin,cmd,evaluate})=>{
  await cmd('Page.navigate',{url:origin+'/dos-maze/tools/bake.html'});
  const value=await evaluate(`(async()=>{
    const {setReferenceGlyphs,buildGlyphCache}=await import('/vector-labyrinth/glyphs.js');
    const master=await (await fetch('/vector-labyrinth/reference-master.json')).json();
    setReferenceGlyphs(master.glyphs);const cache=buildGlyphCache('EIGENGOTT','reference');
    const bytes=new Uint8Array(cache.layers.length*512*512*2);cache.layers.forEach((data,i)=>bytes.set(data,i*data.length));
    const parts=[];for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
    return {atlas:btoa(parts.join('')),glyphs:cache.glyphs.map(g=>({aspect:g.aspect,sourceHeight:g.sourceHeight,layer:g.layer,native:{box:g.native.box,strokes:g.native.strokes}}))};
  })()`);
  const atlas=Buffer.from(value.atlas,'base64'),g=JSON.parse(await readFile(new URL('../../vector-labyrinth/concept-guide.json',import.meta.url),'utf8'));
  const guide=Buffer.alloc(g.width*g.height);let at=0;
  for(let i=0;i<g.runs.length;i+=2){guide.fill(g.runs[i+1],at,at+g.runs[i]);at+=g.runs[i];}
  if(at!==guide.length)throw new Error('Invalid composition guide');
  // Cache the exact binary masks, rather than 4.7 MB of distance fields.
  // WASM recreates those fields byte-for-byte in borrowed startup workspace.
  const bits=Buffer.alloc(atlas.length/16);
  for(let i=0;i<atlas.length/2;i++)if(atlas[i*2]<128)bits[i>>3]|=1<<(i&7);
  const bytes=Buffer.concat([bits,guide]),compressed=gzipSync(bytes,{level:9});
  const meta={version:1,atlasSize:512,layers:value.glyphs.length,maskBytes:bits.length,atlasBytes:atlas.length,atlasSha256:createHash('sha256').update(atlas).digest('hex'),guideWidth:g.width,guideHeight:g.height,guideBytes:guide.length,sha256:createHash('sha256').update(bytes).digest('hex'),glyphs:value.glyphs};
  await writeFile(new URL('assets/title.json',root),JSON.stringify(meta)+'\n');
  await writeFile(new URL('assets/title.bin.gz',root),compressed);
  console.log(JSON.stringify({atlasBytes:atlas.length,compressedBytes:compressed.length,glyphs:meta.layers}));
});
