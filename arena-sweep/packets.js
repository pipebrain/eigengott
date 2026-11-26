export const hash=value=>{let x=value>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return (x^(x>>>16))>>>0;};
export function makeProp(g,variant){if(!g.flat)return null;const {p,size,ceil}=g.flat;const h=[size*(.10+.025*(variant%3)),size*(.10+.025*((variant+1)%3)),Math.min(1.35,(ceil-p[2]-.5)*.4)];const c=[p[0]+(variant%2?1:-1)*size*.12,p[1]+(variant%3-1)*size*.1,p[2]+h[2]];return {gid:g.id,variant,c,h};}
export function planPacket({groups,current,seed,cycle,protectedIds,coherence}){
 const protect=new Set(protectedIds),selected=[],next=current.map(p=>p?structuredClone(p):null);for(const g of groups){if(!g.cells.length||protect.has(g.id)||hash(seed^Math.imul(cycle,0x9e3779b9)^g.id)/4294967296>=1-coherence)continue;const old=current[g.id]?.variant??0;next[g.id]=makeProp(g,(old+1+hash(seed^g.id^cycle) %5)%6);selected.push(g.id);}
 for(const p of next){if(!p)continue;const g=groups[p.gid],f=g.flat;if(!f||p.h.some(x=>!Number.isFinite(x)||x<=0)||p.c.some(x=>!Number.isFinite(x))||Math.abs(p.c[0]-f.p[0])+p.h[0]*1.12>f.size*.40||Math.abs(p.c[1]-f.p[1])+p.h[1]*1.12>f.size*.40||p.c[2]+p.h[2]>f.ceil-.15)throw new Error('Replacement violates its canonical cell boundary.');}
 return {seed,cycle,selected,next};
}
