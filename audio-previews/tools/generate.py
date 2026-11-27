#!/usr/bin/env python3
"""Offline procedural auditions informed by the user's three recordings. No integration."""
import hashlib,json,wave,math
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets';OUT.mkdir(exist_ok=True);RATE=48000

def reference(name):
 p=ROOT.parent/'playable-test/assets'/f'{name}.wav'
 with wave.open(str(p),'rb') as w:
  rate=w.getframerate();channels=w.getnchannels();x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float).reshape(-1,channels)/32768
 mono=x.mean(axis=1);step=max(1,rate//50);env=np.array([np.sqrt(np.mean(mono[i:i+step]**2)) for i in range(0,len(mono)-step,step)])
 sample=mono[:min(len(mono),rate*12)];spectrum=abs(np.fft.rfft(sample*np.hanning(len(sample))));freq=np.fft.rfftfreq(len(sample),1/rate);edges=np.geomspace(35,14000,33);bands=np.array([np.sqrt(np.mean(spectrum[(freq>=a)&(freq<b)]**2)+1e-12) for a,b in zip(edges[:-1],edges[1:])]);valid=(freq>65)&(freq<1800);ids=np.where(valid)[0];order=ids[np.argsort(spectrum[ids])[-40:][::-1]];peaks=[]
 for i in order:
  if all(abs(freq[i]-f)>35 for f in peaks):peaks.append(float(freq[i]))
  if len(peaks)==5:break
 return {'source':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'duration':len(x)/rate,'envelope':env.tolist(),'bandCenters':np.sqrt(edges[:-1]*edges[1:]).tolist(),'bandEnergy':bands.tolist(),'peaks':peaks}

def colored(n,ref,rng):
 f=np.fft.rfftfreq(n,1/RATE);weights=np.interp(np.log(np.maximum(f,35)),np.log(ref['bandCenters']),ref['bandEnergy']);weights/=max(weights.max(),1e-9);weights*=1/(1+(f/6500)**4);weights[f<30]=0;phase=rng.uniform(0,2*np.pi,len(f));a=np.fft.irfft(weights*np.exp(1j*phase),n);return a/(a.std()+1e-9)

def create(kind,variant,ref):
 duration={'ambient-loop':12,'warn-loop':8,'death':2 if variant=='a' else 2.5}[kind];n=int(duration*RATE);t=np.arange(n)/RATE;rng=np.random.default_rng(20261126+len(kind)*17+ord(variant));noise=colored(n,ref,rng);peaks=ref['peaks'] or [93,157,263];base=max(40,min(180,peaks[0]/(2**math.floor(math.log2(peaks[0]/90)))));signal=np.zeros(n)
 if kind!='death':
  # Integer-period partials and periodic noise make these actual repeatable loops.
  for i,ratio in enumerate([1,1.498,2.013,3.17,4.07]):
   hz=round(base*ratio*duration)/duration;signal+=np.sin(2*np.pi*hz*t+rng.uniform(0,6.28))/(i+1)**1.4
  env=np.asarray(ref['envelope']);env=env/(env.max()+1e-9);shape=np.interp(t/duration,np.linspace(0,1,len(env)),env);shape=.55+.45*shape
  pulse=np.sin(2*np.pi*(2 if kind=='ambient-loop' else 12)*t/duration)
  if variant=='a':signal=signal*.23+noise*.055*(.5+.5*pulse**2)
  else:signal=noise*.19*(.25+.75*np.maximum(0,pulse)**4)+signal*.10*np.sin(2*np.pi*3*t/duration)**2
  if kind=='warn-loop':
   # Preserve the source's envelope rhythm while giving each warning pulse an edge.
   pattern=np.maximum(0,np.sin(2*np.pi*(16 if variant=='a' else 24)*t/duration))**8
   signal=signal*.6+pattern*np.sin(2*np.pi*(round(base*5*duration)/duration)*t)*.35
  signal*=shape
 else:
  contour=np.asarray(ref['envelope']);contour/=contour.max()+1e-9;shape=np.interp(t/duration,np.linspace(0,1,len(contour)),contour);shape=.2+.8*shape
  for i,f in enumerate(peaks[:5]):
   hz=max(70,min(1400,f));phase=2*np.pi*(hz*t-hz*.10*t*t/duration);signal+=np.sin(phase+rng.uniform(0,6.28))*np.exp(-t*(3.5+i))*.24/(i+1)
  impact=np.sin(2*np.pi*(95*t-22*t*t))*np.exp(-t*9)
  attack=noise*np.exp(-t*(19 if variant=='a' else 10))
  signal=(signal*.65+impact*.45+attack*.25)*shape
  if variant=='b':signal+=noise*.10*np.exp(-t*2.4)*(.3+.7*np.sin(2*np.pi*13*t)**2)
 # Conservative output level, DC removal and short endpoint windows; no clipping.
 signal-=signal.mean();signal/=max(signal.std(),1e-9);signal*=10**((-22 if kind=='ambient-loop' else -20 if kind=='warn-loop' else -17)/20)
 right=signal*.94+np.roll(noise,311)*(.008 if kind!='death' else .004);stereo=np.stack([signal,right],axis=1);fade=int(RATE*(.008 if kind=='death' else .015));stereo[:fade]*=np.linspace(0,1,fade)[:,None];stereo[-fade:]*=np.linspace(1,0,fade)[:,None];stereo-=stereo.mean(axis=0);peak=abs(stereo).max();stereo*=min(1,.75/max(peak,1e-9));stereo[0]=0;stereo[-1]=0
 data=np.clip(np.rint(stereo*32767),-32767,32767).astype('<i2');file=f'{kind}-{variant}.wav'
 with wave.open(str(OUT/file),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(data.tobytes())
 return {'file':file,'kind':kind,'variant':variant.upper(),'duration':duration,'rate':RATE,'channels':2,'loop':kind!='death','peak':float(abs(data.astype(float)).max()/32768),'rms':float(np.sqrt(np.mean((data.astype(float)/32768)**2))),'dc':data.astype(float).mean(axis=0).tolist(),'seamJump':float(np.max(abs(data[0].astype(float)-data[-1].astype(float)))),'sha256':hashlib.sha256((OUT/file).read_bytes()).hexdigest()}
refs={n:reference(n) for n in ['ambient-loop','warn-loop','death']};files=[create(n,v,refs[n]) for n in refs for v in ['a','b']];(OUT/'manifest.json').write_text(json.dumps({'version':1,'generator':'tools/generate.py','numpy':np.__version__,'integrated':False,'references':refs,'files':files},indent=2)+'\n');print(json.dumps(files,indent=2))
