// Custom reference-inspired outlines; not an identified or redistributed font.
// Canvas 2D is a font-cache utility only. Visible frames are all WebGPU.
const H=244;
const gothic={
  E:{w:73,p:[[[0,0],[73,0],[73,57],[54,37],[30,37],[30,99],[53,99],[64,116],[51,134],[30,134],[30,207],[54,207],[73,186],[73,244],[0,244]]]},
  I:{w:26,p:[[[0,0],[26,16],[26,244],[0,226]]]},
  G:{w:79,p:[[[79,62],[53,42],[30,42],[30,199],[51,210],[51,142],[38,142],[38,116],[79,116],[79,244],[34,244],[11,225],[0,201],[0,36],[21,9],[49,0],[79,27]]]},
  N:{w:85,p:[[[0,0],[27,8],[58,132],[58,0],[85,9],[85,244],[59,235],[27,110],[27,244],[0,234]]]},
  O:{w:79,p:[[[0,31],[17,10],[40,0],[79,26],[79,211],[61,233],[38,244],[0,218]],[[30,43],[49,49],[49,201],[30,195]]]},
  T:{w:78,p:[[[0,0],[78,0],[78,56],[55,38],[49,43],[49,244],[27,244],[27,43],[22,38],[0,56]]]},
};
export const ATLAS_SIZE=512;
let referenceGlyphs=[];
export function setReferenceGlyphs(glyphs){referenceGlyphs=glyphs;}
const INF=10000,SQRT2=Math.SQRT2;
function distancePass(d,n){
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x;let v=d[i];
    if(x)v=Math.min(v,d[i-1]+1);
    if(y){v=Math.min(v,d[i-n]+1);if(x)v=Math.min(v,d[i-n-1]+SQRT2);if(x+1<n)v=Math.min(v,d[i-n+1]+SQRT2);}
    d[i]=v;
  }
  for(let y=n-1;y>=0;y--)for(let x=n-1;x>=0;x--){
    const i=y*n+x;let v=d[i];
    if(x+1<n)v=Math.min(v,d[i+1]+1);
    if(y+1<n){v=Math.min(v,d[i+n]+1);if(x)v=Math.min(v,d[i+n-1]+SQRT2);if(x+1<n)v=Math.min(v,d[i+n+1]+SQRT2);}
    d[i]=v;
  }
}
function signedDistance(alpha){
  const n=ATLAS_SIZE,count=n*n,white=new Float32Array(count),black=new Float32Array(count);
  for(let i=0;i<count;i++){const inside=alpha[i*4+3]>=128;white[i]=inside?0:INF;black[i]=inside?INF:0;}
  distancePass(white,n);distancePass(black,n);
  const result=new Uint8Array(count*2);
  for(let i=0;i<count;i++){
    const inside=alpha[i*4+3]>=128;
    const d=white[i]-black[i]+(inside?.5:-.5);
    const encoded=Math.round(Math.max(0,Math.min(1,d/512+.5))*65535);
    result[i*2]=encoded>>8;result[i*2+1]=encoded&255;
  }
  return result;
}
export function buildGlyphCache(text,font){
  const chars=Array.from(text).slice(0,24),unique=new Map(),layers=[],glyphs=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=ATLAS_SIZE;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  for(const [index,char]of chars.entries()){
    const key=font==='reference'?char+':'+index:char;
    if(!unique.has(key)){
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ATLAS_SIZE,ATLAS_SIZE);ctx.fillStyle='white';
      const shape=font==='gothic'?gothic[char.toUpperCase()]:null;
      const native=font==='reference'?(referenceGlyphs[index]?.char===char?referenceGlyphs[index]:referenceGlyphs.find(g=>g.char===char)):null;
      let aspect,sourceHeight;
      if(native){
        const width=native.box[2]-native.box[0],height=native.box[3]-native.box[1];aspect=width/height;sourceHeight=320;
        const k=sourceHeight/height,ox=(ATLAS_SIZE-width*k)/2,oy=(ATLAS_SIZE-sourceHeight)/2;
        for(const [x,y,w,h]of native.rects)ctx.fillRect(ox+x*k,oy+y*k,w*k,h*k);
      }else if(shape){
        aspect=shape.w/H;sourceHeight=320;
        const k=sourceHeight/H,ox=(ATLAS_SIZE-shape.w*k)/2,oy=(ATLAS_SIZE-sourceHeight)/2;
        ctx.beginPath();
        for(const polygon of shape.p){polygon.forEach(([x,y],i)=>i?ctx.lineTo(ox+x*k,oy+y*k):ctx.moveTo(ox+x*k,oy+y*k));ctx.closePath();}
        ctx.fill('evenodd');
      }else{
        const family=font==='custom'?'"LabyrinthImported"':font==='mono'?'monospace':font==='sans'?'Arial, sans-serif':'Georgia, serif';
        ctx.font=`900 180px ${family}`;
        const m=ctx.measureText(char),cap=ctx.measureText('H');
        const top=Math.max(cap.actualBoundingBoxAscent||130,m.actualBoundingBoxAscent||0),bottom=Math.max(0,m.actualBoundingBoxDescent||0);
        const left=m.actualBoundingBoxLeft||0,width=Math.max(12,(m.actualBoundingBoxRight||m.width)+left);
        const condensed=font==='serif'||font==='gothic'?.58:1;
        aspect=char===' '?.18:Math.max(.08,width*condensed/(top+bottom));
        sourceHeight=Math.min(320,380/aspect);
        const k=sourceHeight/(top+bottom),sx=k*condensed;
        ctx.setTransform(sx,0,0,k,(ATLAS_SIZE-width*sx)/2+left*sx,(ATLAS_SIZE-sourceHeight)/2+top*k);
        ctx.fillText(char,0,0);
      }
      const descriptor={char,aspect,sourceHeight,layer:layers.length,native};
      layers.push(signedDistance(ctx.getImageData(0,0,ATLAS_SIZE,ATLAS_SIZE).data));unique.set(key,descriptor);
    }
    glyphs.push(unique.get(key));
  }
  return {glyphs,layers};
}

export function layoutGlyphs(cache,settings,width,height,chaos,time,directions){
  const fit=Math.min(width/1376,height/768);
  const baseHeight=244*fit*settings.titleScale;
  const tracking=settings.tracking*fit*settings.titleScale;
  const advances=cache.glyphs.map((g,i)=>g.aspect*baseHeight*(settings.characters[i]?.scaleX??1));
  const total=advances.reduce((a,b)=>a+b,0)+Math.max(0,advances.length-1)*tracking;
  const origin=[width*settings.titleX/100,height*settings.titleY/100];
  const angle=settings.titleRotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const data=new Float32Array(cache.glyphs.length*12);
  let x=-total/2,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  cache.glyphs.forEach((glyph,i)=>{
    const local=settings.characters[i]||{};
    const sx=local.scaleX??1,sy=local.scaleY??1;
    const drift=(settings.lockTitle?0:chaos)*settings.textDrift;
    const px=x+advances[i]/2+(local.x||0)+Math.sin(time*.17+i*1.7)*drift*(settings.tectonicMotion?width*.09:16);
    const py=(local.y||0)+Math.cos(time*.13+i*2.1)*drift*(settings.tectonicMotion?height*.16:20);
    const cx=origin[0]+px*c-py*s,cy=origin[1]+px*s+py*c;
    const rot=angle+(local.rotation||0)*Math.PI/180+(settings.tectonicMotion&&!settings.lockTitle?Math.round(Math.sin(i*2.4+time*.09)*chaos*settings.plateRotation)*Math.PI/2:0);
    const qx=baseHeight*sx*ATLAS_SIZE/glyph.sourceHeight,qy=baseHeight*sy*ATLAS_SIZE/glyph.sourceHeight;
    data.set([cx,cy,qx,qy,Math.cos(rot),Math.sin(rot),glyph.layer,directions?.[i]??local.flow??0,settings.deadspace,local.opacity??1,0,0],i*12);
    const gw=advances[i],gh=baseHeight*sy;
    const bw=Math.abs(Math.cos(rot))*gw+Math.abs(Math.sin(rot))*gh,bh=Math.abs(Math.sin(rot))*gw+Math.abs(Math.cos(rot))*gh;
    minX=Math.min(minX,cx-bw/2);maxX=Math.max(maxX,cx+bw/2);minY=Math.min(minY,cy-bh/2);maxY=Math.max(maxY,cy+bh/2);
    x+=advances[i]+tracking;
  });
  const box=cache.glyphs.length?[minX,minY,maxX,maxY]:[-100,-100,-100,-100];
  return {data,box,native:cache.glyphs.map(g=>g.native),atHome:chaos<.000001||settings.lockTitle};
}
