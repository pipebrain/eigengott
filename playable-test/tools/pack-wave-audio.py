#!/usr/bin/env python3
import zipfile,hashlib,io,json
from pathlib import Path
release=Path('.local/openarena/openarena-0.8.8.zip').read_bytes();assert hashlib.md5(release).hexdigest()=='9f353d96d7889c377349d692c3905e5b'
z=zipfile.ZipFile(io.BytesIO(release));vfs={}
for p in sorted(z.namelist()):
 if '/baseoa/' in p and p.endswith('.pk3'):
  a=zipfile.ZipFile(io.BytesIO(z.read(p)))
  for n in a.namelist():
   if n in ['sound/world/teleout.wav','sound/world/telein.wav','sound/items/respawn1.wav']:vfs[n]=a.read(n)
manifest=[]
with zipfile.ZipFile('playable-test/licenses/source-wave-audio.zip','w',zipfile.ZIP_DEFLATED) as out:
 for name,path in [('delete','sound/world/teleout.wav'),('insert','sound/world/telein.wav'),('release','sound/items/respawn1.wav')]:
  b=vfs[path];Path('playable-test/assets/wave-'+name+'.wav').write_bytes(b);out.writestr(path,b);manifest.append({'file':'../assets/wave-'+name+'.wav','upstreamPath':path,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
 for p in ['COPYING','CREDITS','README']:out.writestr(p+'.txt',z.read('openarena-0.8.8/'+p))
Path('playable-test/licenses/wave-audio.json').write_text(json.dumps({'upstream':'OpenArena 0.8.8','releaseMD5':hashlib.md5(release).hexdigest(),'samples':manifest,'conversion':'none; original WAV bytes'},indent=2)+'\n')
print(json.dumps(manifest))
