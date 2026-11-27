#!/usr/bin/env python3
"""Convert selected stock OpenArena armor and effect materials; no runtime dependency."""
import ast,gzip,hashlib,io,json,re,struct,zipfile,math
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets';LICENSE=ROOT/'licenses';LICENSE.mkdir(exist_ok=True)
release=Path('.local/openarena/openarena-0.8.8.zip').read_bytes();assert hashlib.md5(release).hexdigest()=='9f353d96d7889c377349d692c3905e5b';archive=zipfile.ZipFile(io.BytesIO(release));vfs={}
for file in sorted(archive.namelist()):
 if '/baseoa/' in file and file.endswith('.pk3'):
  pk=zipfile.ZipFile(io.BytesIO(archive.read(file)))
  for name in pk.namelist():
   p=name.lower()
   if p.endswith('.shader') or p.startswith(('models/powerups/armor/','gfx/','textures/oafx/','textures/oa/muzzle/','textures/flares/','models/ammo/')) or (p.startswith(('models/weapons','textures/sfx/')) and p.endswith(('.tga','.jpg','.png'))):vfs[p]=pk.read(name)
# Reuse only the existing converter's parser definitions, without its file-writing main.
source=Path('encounter-test/tools/pack-openarena.py').read_text();tree=ast.parse(source)
for node in tree.body:
 if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['cstr','Pack']:
  exec(compile(ast.Module(body=[node],type_ignores=[]),'<shared MD3 parser>','exec'))
used=set();shader_bodies={};shader_owner={}
for path,raw in vfs.items():
 if not path.endswith('.shader'):continue
 text=re.sub(r'/\*.*?\*/','',re.sub(r'//[^\n]*','',raw.decode('utf8','replace')),flags=re.S)
 for m in re.finditer(r'([^\s{}]+)\s*\{',text):
  if m.start() and text[:m.start()].count('{')!=text[:m.start()].count('}'):continue
  depth=1;i=m.end()
  while i<len(text) and depth:depth+=(text[i]=='{')-(text[i]=='}');i+=1
  shader_bodies[m[1].lower()]=text[m.end():i-1];shader_owner[m[1].lower()]=path
entries=[];blob=bytearray();images={};manifest={}
def put(key,data):
 while len(blob)%4:blob.append(0)
 entries.append({'key':key,'offset':len(blob),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()});blob.extend(data)
def resolve(name):
 n=name.lower();base=re.sub(r'\.(tga|jpg|png)$','',n)
 for p in [n,base+'.tga',base+'.jpg',base+'.png']:
  if p in vfs:return p
 return None
def image(name):
 p=resolve(name)
 if not p:return None
 used.add(p)
 if p not in images:
  im=Image.open(io.BytesIO(vfs[p])).convert('RGBA');im.thumbnail((256,256));
  if im.getextrema()[3][0]==255 and any(t in p for t in ['smoke','bloodspew']):
   gray=im.convert('L');base=min(gray.getpixel((x,y)) for x,y in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]);im.putalpha(gray.point(lambda v:max(0,min(255,round((v-base)*255/max(1,255-base))))))
  buf=io.BytesIO();im.save(buf,format='PNG');key='fx-'+hashlib.sha256(buf.getvalue()).hexdigest()[:16]+'.png';put(key,buf.getvalue());images[p]=key;manifest[key]={'source':p,'width':im.width,'height':im.height,'alphaMin':im.getextrema()[3][0],'alphaMax':im.getextrema()[3][1]}
 return images[p]
def stages(shader):
 body=shader_bodies.get(shader.lower(),'');result=[]
 if body:used.add(shader_owner[shader.lower()])
 for section in re.findall(r'\{([^{}]*)\}',body):
  amap=re.search(r'\banimmap\s+([\d.]+)\s+([^\n\r{}]+)',section,re.I);mp=re.search(r'\b(?:map|clampmap)\s+([^\s{}]+)',section,re.I)
  names=amap[2].split() if amap else [mp[1]] if mp else [];frames=[image(n) for n in names if not n.startswith('$')];frames=[x for x in frames if x]
  if not frames:continue
  b=re.search(r'blendfunc\s+([^\n\r{}]+)',section,re.I);blend=(b[1].lower().strip() if b else '')
  mode='add' if blend=='add' or 'gl_one gl_one' in blend or 'gl_src_alpha gl_one'==blend else 'alpha' if blend and blend!='filter' and 'gl_dst_color' not in blend else 'cutout' if 'alphafunc' in section.lower() else 'opaque'
  color=re.search(r'rgbgen\s+const\s*\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)',section,re.I);rot=re.search(r'tcmod\s+rotate\s+(-?[\d.]+)',section,re.I);scroll=re.search(r'tcmod\s+scroll\s+(-?[\d.]+)\s+(-?[\d.]+)',section,re.I)
  result.append({'frames':frames,'fps':float(amap[1]) if amap else 0,'mode':mode,'billboard':bool(re.search(r'deformvertexes\s+autosprite\b',body,re.I)),'unlit':mode=='add','color':[float(color[i]) for i in [1,2,3]] if color else [1,1,1],'rotate':float(rot[1]) if rot else 0,'scroll':[float(scroll[1]),float(scroll[2])] if scroll else [0,0]})
 if not result:
  key=image(shader)
  if key:result=[{'frames':[key],'fps':0,'mode':'cutout','unlit':False,'color':[1,1,1],'rotate':0,'scroll':[0,0]}]
 return result[:4]
armor=[]
for id in ['red','yel','shard']:
 pack=Pack();part=pack.md3('models/powerups/armor/'+('shard' if id=='shard' else 'armor_'+id)+'.md3');mats=[stages(s['shader']) for s in part['surfaces']];used|=pack.used
 meta={'id':id,'kind':'armor','parts':{'main':part},'materials':{'main':[m[0]['frames'][0] if m else None for m in mats]}};head=json.dumps(meta,separators=(',',':')).encode();head+=b' '*(-len(head)%4);put('armor-'+id,b'EGA1'+struct.pack('<II',len(head),len(pack.blob))+head+pack.blob);armor.append({'id':id,'key':'armor-'+id})
weapons={}
for file in sorted(Path('encounter-test/assets').glob('w-*.bin.gz')):
 data=gzip.decompress(file.read_bytes());n=struct.unpack_from('<I',data,4)[0];meta=json.loads(data[12:12+n]);weapons[str(meta['id'])]={name:[stages(s['shader']) for s in p['surfaces']] for name,p in meta['parts'].items()}
# Known stock effects; resolve actual filenames from the merged release.
def pick(terms):
 candidates=[p for p in vfs if p.endswith(('.tga','.jpg','.png')) and any(t in p for t in terms)]
 candidates.sort(key=lambda p:(not p.startswith('gfx/'),len(p),p));assert candidates,terms
 return candidates[0]
sprite_paths={'smoke':'gfx/misc/smokepuff3.tga' if 'gfx/misc/smokepuff3.tga' in vfs else pick(['smokepuff','smoke']), 'glow':pick(['flare.tga','flare.jpg']), 'spark':pick(['spark']), 'blood':pick(['blood']), 'flash':pick(['muzzley.tga']), 'rocket':'textures/flares/wide.tga'}
sprites={k:{'image':image(p),'mode':'alpha' if k in ['smoke','blood'] else 'add','source':p} for k,p in sprite_paths.items()}
# Quake-style black-background smoke may depend on additive rather than file alpha.
for key in ['smoke','blood']:
 im=manifest[sprites[key]['image']]
 if im['alphaMin']==255:sprites[key]['mode']='add'
catalog={'version':1,'upstream':'OpenArena 0.8.8','releaseMD5':hashlib.md5(release).hexdigest(),'armor':armor,'weapons':weapons,'sprites':sprites,'images':manifest,'entries':entries};head=json.dumps(catalog,separators=(',',':')).encode();head+=b' '*(-len(head)%4);raw=b'EGFX'+struct.pack('<II',len(head),len(blob))+head+blob;packed=gzip.compress(raw,compresslevel=9,mtime=0);(OUT/'effects.bin.gz').write_bytes(packed)
with zipfile.ZipFile(LICENSE/'source-effects.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(used):
  info=zipfile.ZipInfo(p,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,vfs[p])
 for p in ['COPYING','CREDITS','README']:z.writestr(p+'.txt',archive.read('openarena-0.8.8/'+p))
(LICENSE/'COPYING.txt').write_bytes(archive.read('openarena-0.8.8/COPYING'))
(LICENSE/'effects-manifest.json').write_text(json.dumps({'upstream':catalog['upstream'],'releaseMD5':catalog['releaseMD5'],'runtime':{'file':'../assets/effects.bin.gz','sha256':hashlib.sha256(packed).hexdigest(),'bytes':len(packed)},'originalInputs':[{'path':p,'sha256':hashlib.sha256(vfs[p]).hexdigest()} for p in sorted(used)]},indent=2)+'\n')
print(json.dumps({'bytes':len(packed),'images':len(manifest),'armor':armor,'sprites':sprites,'weaponMaterials':len(weapons)},indent=2))
