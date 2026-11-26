import {hash} from './animation.js';
// Event-driven state is separate from masks: a hatch change never rebuilds a font.
export class HatchDrift{
  constructor(){this.reset();}
  reset(pose){
    this.event=Number.isInteger(pose?.event)?Math.max(0,Math.min(2000000,pose.event)):0;
    this.global=Number.isInteger(pose?.global)?((pose.global%4)+4)%4:null;
    this.letters=Array.from({length:24},(_,i)=>Number.isInteger(pose?.letters?.[i])?((pose.letters[i]%4)+4)%4:null);
  }
  capture(){return {event:this.event,global:this.global,letters:[...this.letters]};}
  update(s,mazeEvents,textEvents){
    const events=s.hatchTrigger==='maze'?mazeEvents:s.hatchTrigger==='either'?mazeEvents+textEvents:textEvents;
    const n=s.allowDiagonal?4:2,random=(key)=>hash(s.seed^Math.imul(this.event,0x9e3779b9)^key)/4294967296;
    const next=(old,key)=>{old=(old??0)%n;return s.hatchSequence==='cycle'?(old+1)%n:(old+1+Math.floor(random(key)*(n-1)))%n;};
    for(let e=0;e<events;e++){
      this.event++;
      if(s.hatchFlickerGlobal&&random(13)<s.hatchChance)this.global=next(this.global??(s.titleHatch==='letters'?0:+s.titleHatch),37);
      if(s.hatchFlickerLetters)for(let i=0;i<Array.from(s.title).length;i++)if(s.characters[i]?.hatchFlicker!==false&&random(i*17+71)<s.hatchLetterChance){
        this.letters[i]=next(this.letters[i]??0,i*31+113);
      }
    }
    return Array.from(s.title,(_,i)=>{
      const base=s.titleHatch==='letters'?(s.characters[i]?.flow??0):+s.titleHatch;
      const global=s.hatchFlickerGlobal&&this.global!==null?this.global:base;
      const result=s.hatchFlickerLetters&&s.characters[i]?.hatchFlicker!==false&&this.letters[i]!==null?(global+this.letters[i])%n:global;
      return s.allowDiagonal?result:result%2;
    });
  }
}

// All directions use one perpendicular pitch and one screen-space stroke width.
export function titleStrokes(layout,pitch,phase,settings){
  const out=[],data=layout.data;
  for(let id=0;id<data.length/12;id++){
    const j=id*12,cx=data[j],cy=data[j+1],w=data[j+2],h=data[j+3],c=data[j+4],s=data[j+5],flow=data[j+7];
    const native=layout.native?.[id];
    if(native&&settings.referenceHatch&&!settings.constantGap&&(!settings.tectonicMotion||layout.atHome)&&settings.titleHatch==='letters'&&!settings.hatchFlickerGlobal&&!settings.hatchFlickerLetters&&flow===0){
      const gw=native.box[2]-native.box[0],gh=native.box[3]-native.box[1],sx=w*320/512/gh,sy=h*320/512/gh;
      const accepted=[];
      for(const [x1,y1,x2,y2]of [...native.strokes].reverse()){
        let intervals=[[y1,y2]];
        if(settings.preventOverlap)for(const [x,a,b]of accepted)if(Math.abs((x-x1)*sx)<settings.wallWidth+.1){
          const pad=settings.wallWidth/Math.abs(sy);intervals=intervals.flatMap(([lo,hi])=>b+pad<=lo||a-pad>=hi?[[lo,hi]]:[...(a-pad>lo?[[lo,a-pad]]:[]),...(b+pad<hi?[[b+pad,hi]]:[])]);
        }
        for(const [a,b]of intervals){
        if(b-a<.5)continue;accepted.push([x1,a,b]);
        const ax=(x1-gw/2)*sx,ay=(a-gh/2)*sy,bx=(x2-gw/2)*sx,by=(b-gh/2)*sy;
        out.push(cx+ax*c-ay*s,cy+ax*s+ay*c,cx+bx*c-by*s,cy+bx*s+by*c,id,0,0,0);
        }
      }continue;
    }
    const radius=(Math.abs(w*c)+Math.abs(h*s)+Math.abs(w*s)+Math.abs(h*c))*.5+pitch;
    const angle=[Math.PI/2,0,Math.PI/4,-Math.PI/4][flow],dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
    const center=cx*nx+cy*ny,offset=phase[0]*nx+phase[1]*ny;
    for(let k=Math.floor((center-radius-offset)/pitch);k<=Math.ceil((center+radius-offset)/pitch);k++){
      const distance=k*pitch+offset-center,px=cx+nx*distance,py=cy+ny*distance;
      out.push(px-dx*radius,py-dy*radius,px+dx*radius,py+dy*radius,id,0,0,0);
    }
  }
  return new Float32Array(out);
}
