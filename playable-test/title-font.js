// Same custom Gothic glyphs and condensed serif fallback used by the title study.
// A one-time mask cache; all visible lettering is rendered by WebGPU.
const gothic={
  E:{w:73,p:[[[0,0],[73,0],[73,57],[54,37],[30,37],[30,99],[53,99],[64,116],[51,134],[30,134],[30,207],[54,207],[73,186],[73,244],[0,244]]]},
  I:{w:26,p:[[[0,0],[26,16],[26,244],[0,226]]]},
  G:{w:79,p:[[[79,62],[53,42],[30,42],[30,199],[51,210],[51,142],[38,142],[38,116],[79,116],[79,244],[34,244],[11,225],[0,201],[0,36],[21,9],[49,0],[79,27]]]},
  N:{w:85,p:[[[0,0],[27,8],[58,132],[58,0],[85,9],[85,244],[59,235],[27,110],[27,244],[0,234]]]},
  O:{w:79,p:[[[0,31],[17,10],[40,0],[79,26],[79,211],[61,233],[38,244],[0,218]],[[30,43],[49,49],[49,201],[30,195]]]},
  T:{w:78,p:[[[0,0],[78,0],[78,56],[55,38],[49,43],[49,244],[27,244],[27,43],[22,38],[0,56]]]},
};

export function titleAtlas(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='white';const glyphs=new Map();
 for(let i=0;i<32;i++){const char='ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'[i],x=(i%8)*64,y=Math.floor(i/8)*256,shape=gothic[char];ctx.save();ctx.translate(x+5,y+6);
 if(shape){ctx.scale(52/shape.w,244/244);ctx.beginPath();for(const p of shape.p){p.forEach(([a,b],j)=>j?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();}ctx.fill('evenodd');}
 else{ctx.font='900 330px Georgia,serif';const m=ctx.measureText(char),top=m.actualBoundingBoxAscent||244,bottom=m.actualBoundingBoxDescent||0;ctx.scale(52/Math.max(1,m.width),244/(top+bottom));ctx.fillText(char,0,top);}
 ctx.restore();glyphs.set(char,{u:(x+4)/512,v:(y+5)/1024,w:54/512,h:246/1024,aspect:(shape?.w||78)/244});
 }return {canvas,glyphs};
}
