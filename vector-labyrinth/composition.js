export async function loadCompositionGuide(sim){
  const response=await fetch('concept-guide.json');if(!response.ok)throw new Error('Could not load the concept composition guide.');
  const data=await response.json(),buffer=new Uint8Array(sim.memory.buffer,sim.get_guide_buffer(),data.width*data.height);
  let at=0;for(let i=0;i<data.runs.length;i+=2){buffer.fill(data.runs[i+1],at,at+data.runs[i]);at+=data.runs[i];}
  if(at!==buffer.length)throw new Error('Invalid concept composition guide.');
  sim.set_guide_size(data.width,data.height);
  const masterResponse=await fetch('reference-master.json');if(!masterResponse.ok)throw new Error('Could not load vector reference master.');
  const master=await masterResponse.json();
  new Float32Array(sim.memory.buffer,sim.get_master_buffer(),master.segments.length).set(master.segments);
  sim.set_master(master.segments.length/4,0);
  const voids=new Uint8Array(sim.memory.buffer,sim.get_void_buffer(),344*192);let atVoid=0;
  for(let i=0;i<master.voidRuns.length;i+=2){voids.fill(master.voidRuns[i+1],atVoid,atVoid+master.voidRuns[i]);atVoid+=master.voidRuns[i];}
  return master;
}
