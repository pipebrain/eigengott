import {readdir,readFile,writeFile,mkdir,rm,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'_site');
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Pages requires a full source commit identifier.');
const build={commit,short:commit.slice(0,7),builtAt:new Date().toISOString(),repository:'https://github.com/pipebrain/eigengott'};
const applications=['engine-test','engine-benchmark','arena-fold','arena-fold-2','arena-sweep','encounter-test','playable-test','dos-maze','vector-labyrinth'];
const extensions=new Set(['.html','.css','.js','.wasm','.json','.gz','.bin','.wgsl','.png','.wav','.ogg','.zip','.txt']);
const subdirectories=new Set(['assets','shaders','presets','licenses']);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
async function copyRuntime(relative,depth=0){
  const source=path.join(root,relative),target=path.join(out,relative);await mkdir(target,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error(`Unexpected runtime symlink: ${relative}/${entry.name}`);
    if(entry.isDirectory()){
      if(depth===0&&subdirectories.has(entry.name))await copyRuntime(`${relative}/${entry.name}`,depth+1);
    }else if(entry.isFile()&&extensions.has(path.extname(entry.name))){await copyFile(path.join(source,entry.name),path.join(target,entry.name));}
  }
}
for(const application of applications)await copyRuntime(application);
for(const file of ['index.html','main.js','style.css','deployment.js'])await copyFile(path.join(root,'site',file),path.join(out,file));
const metadata=`<script>globalThis.__EIGENGOTT_BUILD=Object.freeze(${JSON.stringify(build)});</script>`;
for(const relative of ['index.html',...applications.map(app=>`${app}/index.html`)]){
  const file=path.join(out,relative);let html=await readFile(file,'utf8');html=html.replace('</head>',`${metadata}</head>`);
  if(relative!=='index.html')html=html.replace('</body>','<script type="module" src="../deployment.js"></script></body>');
  await writeFile(file,html);
}
await writeFile(path.join(out,'build.json'),JSON.stringify(build,null,2)+'\n');
const files=[];
async function list(relative=''){
  for(const entry of await readdir(path.join(out,relative),{withFileTypes:true})){
    const file=path.posix.join(relative,entry.name);
    if(entry.isDirectory())await list(file);
    else{const bytes=await readFile(path.join(out,file));files.push({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  }
}
await list();files.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(path.join(out,'manifest.json'),JSON.stringify({build,applications,files},null,2)+'\n');
console.log(`Staged ${files.length} runtime files (${files.reduce((sum,f)=>sum+f.bytes,0)} bytes) for ${build.short}.`);
