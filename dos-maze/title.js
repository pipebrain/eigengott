import {PROFILE,LETTERS} from './profile.js';
export function createTitle(meta){
  const data=new Float32Array(9*12),advances=new Float64Array(9),centers=new Float64Array(9);
  let originX=0,originY=0,total=0,baseHeight=0,strokes=new Float32Array();
  function resize(width,height){
    const fit=Math.min(width/1376,height/768);baseHeight=244*fit;
    const tracking=PROFILE.tracking*fit;
    total=0;for(let i=0;i<9;i++){advances[i]=meta.glyphs[i].aspect*baseHeight*LETTERS[i][1];total+=advances[i];}
    total+=8*tracking;originX=width*PROFILE.titleX/100;originY=height*PROFILE.titleY/100;
    let x=-total/2;
    for(let i=0;i<9;i++){
      const glyph=meta.glyphs[i];centers[i]=x+advances[i]/2+LETTERS[i][0];
      data.set([0,0,baseHeight*LETTERS[i][1]*512/glyph.sourceHeight,baseHeight*512/glyph.sourceHeight,1,0,i,0,PROFILE.deadspace,1,0,0],i*12);
      x+=advances[i]+tracking;
    }
    // Relative hatch vectors are fixed until viewport scale changes. Preserve
    // the reference's clipping order; the vertex shader supplies live centers.
    const out=[];
    for(let id=0;id<9;id++){
      const native=meta.glyphs[id].native,gw=native.box[2]-native.box[0],gh=native.box[3]-native.box[1];
      const sx=data[id*12+2]*320/512/gh,sy=data[id*12+3]*320/512/gh,accepted=[];
      for(let k=native.strokes.length-1;k>=0;k--){
        const [x1,y1,x2,y2]=native.strokes[k];let intervals=[[y1,y2]];
        for(const [x,a,b] of accepted)if(Math.abs((x-x1)*sx)<PROFILE.wallWidth+.1){
          const pad=PROFILE.wallWidth/Math.abs(sy);
          intervals=intervals.flatMap(([lo,hi])=>b+pad<=lo||a-pad>=hi?[[lo,hi]]:[...(a-pad>lo?[[lo,a-pad]]:[]),...(b+pad<hi?[[b+pad,hi]]:[])]);
        }
        for(const [a,b] of intervals){
          if(b-a<.5)continue;accepted.push([x1,a,b]);
          out.push((x1-gw/2)*sx,(a-gh/2)*sy,(x2-gw/2)*sx,(b-gh/2)*sy,id,0,0,0);
        }
      }
    }
    strokes=new Float32Array(out);return strokes;
  }
  function update(state,time){
    const drift=state*PROFILE.textDrift;
    for(let i=0;i<9;i++){
      data[i*12]=originX+centers[i]+Math.sin(time*.17+i*1.7)*drift*16;
      data[i*12+1]=originY+Math.cos(time*.13+i*2.1)*drift*20;
    }
    return data;
  }
  return {data,resize,update,get strokeCount(){return strokes.length/8;}};
}
