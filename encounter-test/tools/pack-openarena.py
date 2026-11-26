#!/usr/bin/env python3
"""Offline OpenArena 0.8.8 MD3 packer. No external game code is executed.
Run with Pillow 13.0.0: python tools/pack-openarena.py [release.zip].
Original release inputs and notices accompany converted assets as source ZIPs.
"""
import sys,io,re,math,json,struct,gzip,hashlib,zipfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'assets'; LICENSE=ROOT/'licenses';OUT.mkdir(exist_ok=True);LICENSE.mkdir(exist_ok=True)
ARCHIVE=Path(sys.argv[1] if len(sys.argv)>1 else '.local/openarena/openarena-0.8.8.zip')
release=ARCHIVE.read_bytes();assert hashlib.md5(release).hexdigest()=='9f353d96d7889c377349d692c3905e5b','Unexpected upstream release'
z=zipfile.ZipFile(io.BytesIO(release));vfs={};owner={}
for file in sorted(z.namelist()):
 if '/baseoa/' in file and file.endswith('.pk3'):
  pk=zipfile.ZipFile(io.BytesIO(z.read(file)))
  for name in pk.namelist():
   if not name.endswith('/'):vfs[name.lower()]=pk.read(name);owner[name.lower()]=file.rsplit('/',1)[-1]
def text(name):return vfs[name].decode('utf8','replace')
def cstr(b):return b.split(b'\0')[0].decode('utf8','replace').lower()
def write_json(path,value):path.write_text(json.dumps(value,separators=(',',':'))+'\n')
for name in ['COPYING','CREDITS','README','readme_088.txt']:(LICENSE/(name+'.txt' if '.' not in name else name)).write_bytes(z.read('openarena-0.8.8/'+name))
shaders={}
for name in sorted(vfs):
 if name.endswith('.shader'):
  code=re.sub(r'/\*.*?\*/','',re.sub(r'//[^\n]*','',text(name)),flags=re.S);tokens=re.findall(r'[^\s{}]+|[{}]',code);i=0
  while i<len(tokens)-1:
   key=tokens[i].lower();i+=1
   if tokens[i]!='{':continue
   i+=1;depth=1;body=[]
   while i<len(tokens) and depth:
    t=tokens[i];i+=1;depth+=int(t=='{')-int(t=='}');body.append(t)
   maps=[body[j+1] for j,t in enumerate(body[:-1]) if t.lower() in ['map','clampmap'] and not body[j+1].startswith(('$','*'))]
   if maps:shaders[key]=maps
   else:
    for j,t in enumerate(body[:-2]):
     if t.lower()=='animmap':shaders[key]=[body[j+2]];break
textures={};texture_manifest={};missing=[]
def texture_path(name):
 name=name.replace('\\','/').lower().strip();candidates=[name]
 base=re.sub(r'\.(tga|jpg|jpeg|png)$','',name)
 if base in shaders:candidates=shaders[base]+candidates
 elif name in shaders:candidates=shaders[name]+candidates
 for n in candidates:
  base=re.sub(r'\.(tga|jpg|jpeg|png)$','',n)
  for p in [n,base+'.tga',base+'.jpg',base+'.png',base+'.jpeg']:
   if p in vfs:return p
 return None
def image_asset(shader,used):
 path=texture_path(shader)
 if not path:
  missing.append(shader);return None
 used.add(path)
 if path not in textures:
  im=Image.open(io.BytesIO(vfs[path])).convert('RGBA');im.thumbnail((512,512),Image.Resampling.LANCZOS);data=io.BytesIO();im.save(data,format='PNG',compress_level=9);b=data.getvalue();name='t-'+hashlib.sha256(b).hexdigest()[:20]+'.png';(OUT/name).write_bytes(b);textures[path]=name;texture_manifest[name]={'path':path,'width':im.width,'height':im.height,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 return textures[path]
def skin(path):
 if path not in vfs:return {}
 return {line.split(',',1)[0].strip().lower():line.split(',',1)[1].strip().lower() for line in text(path).splitlines() if ',' in line and not line.strip().startswith('tag_')}
def animations(path):
 rows=[]
 for line in text(path).splitlines():
  m=re.match(r'^\s*(-?\d+)\s+(-?\d+)\s+(\d+)\s+([\d.]+)',line)
  if m:rows.append([int(m[1]),abs(int(m[2])),int(m[3]),float(m[4]),int(m[2])<0])
 assert len(rows)>=25,(path,len(rows));offset=rows[13][0]-rows[6][0]
 for i in range(13,min(25,len(rows))):rows[i][0]-=offset
 return rows
class Pack:
 def __init__(self):self.blob=bytearray();self.used=set()
 def put(self,b):
  while len(self.blob)%4:self.blob.append(0)
  offset=len(self.blob);self.blob.extend(b);return offset
 def md3(self,path):
  b=vfs[path];self.used.add(path);assert b[:4]==b'IDP3' and struct.unpack_from('<i',b,4)[0]==15,path
  flags,nf,nt,ns,nskin,of,ot,os,end=struct.unpack_from('<9i',b,72);assert 0<nf<2048 and ns<64 and len(b)==end,(path,len(b),end)
  tags={}
  for frame in range(nf):
   for t in range(nt):
    at=ot+(frame*nt+t)*112;name=cstr(b[at:at+64]);tags.setdefault(name,[]).append(list(struct.unpack_from('<12f',b,at+64)))
  surfaces=[];frames=[bytearray() for _ in range(nf)];uv=bytearray();indices=[];count=0;at=os
  for _ in range(ns):
   assert b[at:at+4]==b'IDP3';name=cstr(b[at+4:at+68]);sf,sframes,nsh,nv,ntri,tri,shader,st,xyz,send=struct.unpack_from('<10i',b,at+68);assert sframes==nf and nv<100000 and ntri<100000
   shadername=cstr(b[at+shader:at+shader+64]) if nsh else ''
   surfaces.append({'name':name,'shader':shadername,'first':len(indices),'count':ntri*3})
   inds=struct.unpack_from('<'+str(ntri*3)+'i',b,at+tri);assert all(0<=i<nv for i in inds);indices.extend(i+count for i in inds)
   uv.extend(b[at+st:at+st+nv*8])
   for frame in range(nf):
    for i in range(nv):
     x,y,zz,normal=struct.unpack_from('<hhhH',b,at+xyz+(frame*nv+i)*8);lat=(normal>>8)*math.tau/255;lng=(normal&255)*math.tau/255;nx=math.cos(lat)*math.sin(lng);ny=math.sin(lat)*math.sin(lng);nz=math.cos(lng);packed=(round(nx*127)&255)|((round(ny*127)&255)<<8)|((round(nz*127)&255)<<16)
     frames[frame].extend(struct.pack('<fffI',x/64,y/64,zz/64,packed))
   count+=nv;at+=send
  bounds=[list(struct.unpack_from('<6f',b,of+f*56)) for f in range(nf)]
  return {'path':path,'frames':nf,'vertices':count,'positions':self.put(b''.join(frames)),'uv':self.put(uv),'indices':self.put(struct.pack('<'+str(len(indices))+'I',*indices)),'indexCount':len(indices),'surfaces':surfaces,'tags':tags,'bounds':bounds}
 def save(self,id,meta):
  head=json.dumps(meta,separators=(',',':')).encode();head+=b' '*(-len(head)%4);raw=b'EGA1'+struct.pack('<II',len(head),len(self.blob))+head+self.blob;packed=gzip.compress(raw,compresslevel=9,mtime=0);name=id+'.bin.gz';(OUT/name).write_bytes(packed);return {'file':name,'bytes':len(packed),'decodedBytes':len(raw),'sha256':hashlib.sha256(packed).hexdigest()}
 def source(self,name,extra=()):
  used=self.used|set(extra);data=io.BytesIO()
  with zipfile.ZipFile(data,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as a:
   for p in sorted(used):
    if p not in vfs:continue
    info=zipfile.ZipInfo(p,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;a.writestr(info,vfs[p])
   for p in ['COPYING','CREDITS','README']:
    info=zipfile.ZipInfo(p+'.txt',(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;a.writestr(info,z.read('openarena-0.8.8/'+p))
  name='source-'+name+'.zip';(LICENSE/name).write_bytes(data.getvalue());return name
models=sorted({p.split('/')[2] for p in vfs if p.startswith('models/players/') and p.endswith('/lower.md3')});characters=[];roster=[]
botcode=re.sub(r'//[^\n]*','',text('scripts/bots.txt'))
for body in re.findall(r'\{([^}]+)\}',botcode):
 pairs=dict(re.findall(r'(\w+)\s+([^\s{}]+)',body));model=pairs.get('model','');base,_,variant=model.partition('/');
 if base in models:roster.append({'name':pairs['name'],'model':base,'skin':variant or 'default'})
for model in models:
 pack=Pack();prefix=f'models/players/{model}/';parts={p:pack.md3(prefix+p+'.md3') for p in ['lower','upper','head']};anim=animations(prefix+'animation.cfg');pack.used.add(prefix+'animation.cfg');skins={}
 for file in sorted(vfs):
  if file.startswith(prefix) and '/' not in file[len(prefix):] and re.match(r'lower_.+\.skin$',file[len(prefix):]):
   variant=file.rsplit('lower_',1)[1][:-5];skinparts={}
   for part,data in parts.items():
    sp=prefix+part+'_'+variant+'.skin';sp=sp if sp in vfs else prefix+part+'_default.skin';mapping=skin(sp);pack.used.add(sp);skinparts[part]=[image_asset(mapping.get(s['name'],s['shader']),pack.used) if mapping.get(s['name'],s['shader']) not in ['','nodraw','*off'] else None for s in data['surfaces']]
   skins[variant]=skinparts
 assert skins,model
 meta={'id':model,'kind':'character','parts':parts,'animations':anim,'skins':skins};record={'id':model,'skins':list(skins),**pack.save('c-'+model,meta)};record['source']=pack.source(model,[p for p in vfs if p.startswith(prefix)]);characters.append(record);print(model,record['bytes'],list(skins),flush=True)
weapon_paths={1:'weapons2/gauntlet/gauntlet',2:'weapons2/machinegun/machinegun',3:'weapons2/shotgun/shotgun',4:'weapons2/grenadel/grenadel',5:'weapons2/rocketl/rocketl',6:'weapons2/lightning/lightning',7:'weapons2/railgun/railgun',8:'weapons2/plasma/plasma',9:'weapons2/bfg/bfg',10:'weapons2/grapple/grapple',11:'weapons/nailgun/nailgun',12:'weapons/proxmine/proxmine',13:'weapons/vulcan/vulcan'}
weapons=[]
for wid,path in weapon_paths.items():
 pack=Pack();parts={'main':pack.md3('models/'+path+'.md3')};materials={}
 for kind in ['barrel','flash']:
  p='models/'+path+'_'+kind+'.md3'
  if p in vfs:parts[kind]=pack.md3(p)
 shot={4:'models/ammo/grenade1.md3',5:'models/ammo/rocket/rocket.md3',9:'models/weaphits/bfg.md3',10:'models/ammo/hook/hook.md3',11:'models/weaphits/nail.md3',12:'models/weaphits/proxmine.md3'}.get(wid)
 if shot and shot in vfs:parts['projectile']=pack.md3(shot)
 for part,data in parts.items():materials[part]=[image_asset(s['shader'],pack.used) for s in data['surfaces']]
 rec={'id':wid,**pack.save('w-'+str(wid),{'id':wid,'kind':'weapon','parts':parts,'materials':materials})};rec['source']=pack.source('weapon-'+str(wid));weapons.append(rec)
# Original sound data are loaded lazily and shared by source-file hash.
sounds={};sound_inputs=[]
for p in sorted(vfs):
 if p.startswith(('sound/weapons/','sound/player/','sound/player/footsteps/')) and p.endswith(('.wav','.ogg')):
  b=vfs[p];name='s-'+hashlib.sha256(b).hexdigest()[:20]+Path(p).suffix;(OUT/name).write_bytes(b);sounds[p]=name;sound_inputs.append(p)
shared=Pack();shared.source('shared',sound_inputs+[p for p in vfs if p.endswith('.shader') or any(x in p for x in ['credits','copying','license'])]);
write_json(OUT/'catalog.json',{'format':1,'upstream':'OpenArena 0.8.8','releaseMD5':hashlib.md5(release).hexdigest(),'releaseURL':'https://downloads.sourceforge.net/project/oarena/openarena-0.8.8.zip','characters':characters,'roster':roster,'weapons':weapons,'textures':texture_manifest,'sounds':sounds,'missingTextures':sorted(set(missing)),'sources':'../licenses/','preferredSources':'https://openarena.ws/svn/source/assets/'})
print('TOTAL',len(characters),'models',len(roster),'named characters',len(weapons),'weapons',len(textures),'textures',len(sounds),'sounds; missing',sorted(set(missing)),flush=True)
