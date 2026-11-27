import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../_site/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const files=new Map(manifest.files.map(f=>[f.path,f]));
assert.equal(manifest.build.version,'0.1.1');assert.ok(files.has('game/main.js'));assert.ok(files.has('game/preset.js'));
assert.match(manifest.build.commit,/^[a-f0-9]{40}$/);
for(const item of manifest.files){
  assert.ok(!/(^|\/)(?:src|tools|evidence|\.git|\.env|\.local)(?:\/|$)/.test(item.path));
  assert.ok(!/\.(?:rs|c|md|py|toml)$/.test(item.path));
  const bytes=await readFile(new URL(item.path,root));assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
  if(item.path.endsWith('.wasm'))await WebAssembly.compile(bytes);
}
for(const app of manifest.applications){
  for(const file of ['index.html','main.js','style.css'])assert.ok(files.has(`${app}/${file}`),`${app}/${file} missing`);
  const html=await readFile(new URL(`${app}/index.html`,root),'utf8');assert.ok(html.includes(manifest.build.commit));assert.match(html,/src="\.\.\/deployment.js"/);
}
const relativeReferences=/(?:from\s*|import\s*|src=|href=)["'](\.?\.?\/[^"']+|[^/:"'\s]+\/[^"']+|[^/:"'\s]+\.(?:html|js|css|wasm))["']/g;
for(const item of manifest.files.filter(f=>/\.(?:html|js|css)$/.test(f.path))){
  const code=await readFile(new URL(item.path,root),'utf8');
  for(const [,reference]of code.matchAll(relativeReferences)){
    if(reference.includes('${')||reference.startsWith('#'))continue;const url=new URL(reference,new URL(item.path,root));const relative=decodeURIComponent(url.pathname.slice(root.pathname.length));
    if(url.pathname.endsWith('/'))assert.ok(files.has(relative+'index.html'),`${item.path}: missing ${reference}`);
    else assert.ok(files.has(relative),`${item.path}: missing ${reference}`);
  }
}
assert.ok(files.has('engine-benchmark/worker.js'));assert.ok(files.has('dos-maze/assets/title.bin.gz'));assert.ok(files.has('vector-labyrinth/reference-master.json'));
assert.ok(files.has('arena-fold/fold.wasm'));assert.ok(files.has('arena-fold/shaders/feedback.wgsl'));
assert.ok(files.has('arena-fold-2/wave.wasm'));assert.ok(files.has('arena-fold-2/shaders/feedback.wgsl'));
assert.ok(files.has('arena-sweep/engine.wasm'));assert.ok(files.has('arena-sweep/worker.js'));assert.ok(files.has('arena-sweep/shaders/objects.wgsl'));
for(const file of ['engine.wasm','worker.js','media-worker.js','assets/catalog.json','licenses/index.html','licenses/manifest.json'])assert.ok(files.has('encounter-test/'+file));
for(const file of ['engine.wasm','shaders/labyrinth.wgsl','preview.js','assets/ambient-loop.wav','assets/warn-loop.wav','assets/death.wav'])assert.ok(files.has('playable-test/'+file));
for(const file of ['assets/effects.bin.gz','shaders/sprites.wgsl','shaders/lighting.wgsl','licenses/source-effects.zip','licenses/armor-authoring.zip'])assert.ok(files.has('playable-test/'+file));
for(const file of ['assets/manifest.json','assets/ambient-loop-a.wav','assets/warn-loop-b.wav','assets/death-a.wav'])assert.ok(files.has('audio-previews/'+file));
assert.deepEqual((await readdir(root)).sort(),['build.json','deployment.js','dos-maze','engine-benchmark','engine-test','arena-fold','arena-fold-2','arena-sweep','encounter-test','playable-test','audio-previews','game','tests.html','hub.js','hub.css','index.html','main.js','manifest.json','style.css','vector-labyrinth'].sort());
console.log(JSON.stringify({passed:true,build:manifest.build.short,applications:manifest.applications,files:manifest.files.length,bytes:manifest.files.reduce((sum,f)=>sum+f.bytes,0)},null,2));
