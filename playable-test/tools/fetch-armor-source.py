#!/usr/bin/env python3
"""Mirror relevant preferred authoring files at the pinned upstream revision."""
from urllib.request import urlopen
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]/'licenses';base='https://openarena.ws/svn/!svn/bc/951/source/assets/models/newarmor/';rows=[]
with zipfile.ZipFile(root/'armor-authoring.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['armor.blend','armorshard.blend','newshard.mm3d']:
  with urlopen(base+name,timeout=30) as r:data=r.read()
  info=zipfile.ZipInfo('newarmor/'+name,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data);rows.append({'path':name,'url':base+name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(root/'armor-authoring.json').write_text(json.dumps({'revision':951,'files':rows},indent=2)+'\n');print(sum(r['bytes'] for r in rows),'authoring bytes')
