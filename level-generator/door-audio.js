// Two original greybox cues: short motor onset and stop thud, one per moving leaf.
// These buffers are synthesized once per context; no recordings are modified.
export function createDoorAudio(audio){let ctx=null,buffers=null,played=0,dropped=0;
 function prepare(){if(ctx===audio.ctx&&buffers)return;ctx=audio.ctx;buffers={};for(const kind of['start','finish']){const seconds=kind==='start'?.16:.11,b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate),data=b.getChannelData(0);let state=kind==='start'?71:103;for(let i=0;i<data.length;i++){const t=i/ctx.sampleRate,u=t/seconds;state=(Math.imul(state,1664525)+1013904223)>>>0;const noise=state/2147483648-1,envelope=Math.min(1,u*35)*(1-u)**2;data[i]=envelope*(kind==='start'?.45*Math.sin(2*Math.PI*(170*t+160*t*t))+.12*noise:.65*Math.sin(2*Math.PI*65*t)*Math.exp(-u*4)+.22*noise);}buffers[kind]=b;}}
 return{play(event){if(audio.ctx?.state!=='running')return false;prepare();const voice=audio.spatial.play(buffers[event.kind],event.position,.3/Math.sqrt(event.parts));if(voice)played++;else dropped++;return!!voice;},snapshot:()=>({played,dropped,cues:['start','finish'],rate:1,pitch:0})};
}
