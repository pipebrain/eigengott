// The offscreen 2D canvas is used only to rasterize a changed font/text mask.
// Every visible frame, including all slice geometry, is rendered by WebGPU.
const block = {
  A:['01110','11011','10001','10001','11111','10001','10001','10001','10001'],
  B:['11110','10001','10001','10001','11110','10001','10001','10001','11110'],
  C:['11111','10000','10000','10000','10000','10000','10000','10000','11111'],
  D:['11110','10001','10001','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','10000','11110','10000','10000','10000','11111'],
  F:['11111','10000','10000','10000','11110','10000','10000','10000','10000'],
  G:['11111','10000','10000','10000','10111','10001','10001','10001','11111'],
  H:['10001','10001','10001','10001','11111','10001','10001','10001','10001'],
  I:['111','010','010','010','010','010','010','010','111'],
  J:['11111','00001','00001','00001','00001','00001','10001','10001','11111'],
  K:['10001','10001','10010','10100','11100','10100','10010','10001','10001'],
  L:['10000','10000','10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','11111','10101','10101','10001','10001','10001','10001'],
  N:['10001','11001','11001','11101','10101','10111','10011','10011','10001'],
  O:['11111','10001','10001','10001','10001','10001','10001','10001','11111'],
  P:['11111','10001','10001','10001','11111','10000','10000','10000','10000'],
  Q:['11111','10001','10001','10001','10001','10001','10101','10011','11111'],
  R:['11110','10001','10001','10001','11110','10100','10010','10001','10001'],
  S:['11111','10000','10000','10000','11111','00001','00001','00001','11111'],
  T:['11111','00100','00100','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','10001','10001','11111'],
  V:['10001','10001','10001','10001','10001','10001','11011','01110','00100'],
  W:['10001','10001','10001','10001','10101','10101','11111','11011','10001'],
  X:['10001','10001','11011','01110','00100','01110','11011','10001','10001'],
  Y:['10001','10001','10001','11011','01110','00100','00100','00100','00100'],
  Z:['11111','00001','00011','00110','00100','01100','11000','10000','11111'],
};
export const MASK_WIDTH=256,MASK_HEIGHT=512;
export function createMasks(text,font) {
  const chars=Array.from(text).slice(0,24);
  const canvas=document.createElement('canvas');canvas.width=MASK_WIDTH;canvas.height=MASK_HEIGHT;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const layers=[],glyphs=[];
  const margin=12,innerW=MASK_WIDTH-margin*2,innerH=MASK_HEIGHT-margin*2;
  for(const char of chars) {
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,MASK_WIDTH,MASK_HEIGHT);ctx.fillStyle='#fff';
    const grid=font==='block'?block[char]:null;
    let aspect;
    if(grid) {
      aspect=grid[0].length/grid.length;
      for(let y=0;y<grid.length;y++) for(let x=0;x<grid[y].length;x++) if(grid[y][x]==='1')
        ctx.fillRect(margin+x*innerW/grid[y].length,margin+y*innerH/grid.length,innerW/grid[y].length+.1,innerH/grid.length+.1);
    } else {
      const family=font==='custom'?'"EIGENGOTTCustom"':font==='sans'?'Arial, sans-serif':'monospace';
      ctx.font=`900 150px ${family}`;
      const cap=ctx.measureText('H'),metrics=ctx.measureText(char);
      const top=Math.max(cap.actualBoundingBoxAscent||110,metrics.actualBoundingBoxAscent||0);
      const bottom=Math.max(0,metrics.actualBoundingBoxDescent||0);
      const left=metrics.actualBoundingBoxLeft||0;
      const width=Math.max(metrics.actualBoundingBoxRight+left,metrics.width*.4,15);
      aspect=Math.min(2.2,Math.max(.18,width/(top+bottom)));
      ctx.setTransform(innerW/width,0,0,innerH/(top+bottom),margin+left*innerW/width,margin+top*innerH/(top+bottom));
      ctx.fillText(char,0,0);
    }
    // Store filled and contour masks together. Contours are computed once,
    // not with multiple neighboring texture samples in every rendered frame.
    const rgba=ctx.getImageData(0,0,MASK_WIDTH,MASK_HEIGHT).data;
    const result=new Uint8Array(rgba.length),radius=3;
    for(let y=0;y<MASK_HEIGHT;y++) for(let x=0;x<MASK_WIDTH;x++) {
      const at=(y*MASK_WIDTH+x)*4,a=rgba[at+3];
      let inner=a;
      for(const [dx,dy] of [[-radius,0],[radius,0],[0,-radius],[0,radius]]) {
        const nx=x+dx,ny=y+dy;
        inner=Math.min(inner,nx<0||ny<0||nx>=MASK_WIDTH||ny>=MASK_HEIGHT?0:rgba[(ny*MASK_WIDTH+nx)*4+3]);
      }
      result[at]=a;result[at+1]=Math.max(0,a-inner);result[at+3]=255;
    }
    glyphs.push({char,aspect:aspect*MASK_WIDTH/innerW*innerH/MASK_HEIGHT});layers.push(result);
  }
  return {glyphs,layers};
}
