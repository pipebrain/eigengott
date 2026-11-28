// p(next) = p(parent)/2, even when the previous roll succeeded or failed.
// Flags realize that probability directly. Size/category choices inherit with
// that probability; a rejected inheritance draws a different legal proposal.
function fallback(sample,rng,previous){let value=sample(rng),attempts=1;while(value===previous&&attempts++<16)value=sample(rng);return{value,constrained:value===previous};}
export function adjacentDecisions(adjacency,definitions,rng){
 const values=adjacency.map(()=>({})),decisions=adjacency.map(()=>({}));
 for(const [name,d]of Object.entries(definitions)){const seen=new Set();
  while(seen.size<adjacency.length){const root=adjacency.findIndex((_,i)=>!seen.has(i)),value=d.sample(rng),kind=typeof value==='boolean'?'flag':'choice',queue=[root];seen.add(root);decisions[root][name]={value,kind,probability:d.probability,source:root,parent:null,depth:0,applied:kind==='flag'?value:true};values[root][name]=value;
   for(let at=0;at<queue.length;at++){const parent=queue[at],previous=decisions[parent][name];for(const id of adjacency[parent]){if(seen.has(id))continue;seen.add(id);const probability=previous.probability*.5,applied=rng()<probability,other=kind==='choice'&&!applied?fallback(d.sample,rng,previous.value):null,next=kind==='flag'?applied:applied?previous.value:other.value;decisions[id][name]={value:next,kind,probability,source:root,parent,depth:previous.depth+1,applied,constrainedFallback:other?.constrained||false};values[id][name]=next;queue.push(id);}}
  }
 }
 return{values,decisions};
}
export function inheritDecision(parent,sample,rng){const probability=parent.probability*.5,applied=rng()<probability,kind=parent.kind|| (typeof parent.value==='boolean'?'flag':'choice'),other=kind==='choice'&&!applied?fallback(sample,rng,parent.value):null;return{value:kind==='flag'?applied:applied?parent.value:other.value,kind,probability,parentProbability:parent.probability,parent:parent.source,source:parent.source,depth:parent.depth+1,applied,constrainedFallback:other?.constrained||false};}
