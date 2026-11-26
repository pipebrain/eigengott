import {imports,readStats} from './stats.js';

// A disposable worker owns construction, validation, surface assembly, baking,
// and serialization. It never touches the currently playable WASM instance.
self.onmessage=async({data:{module,seed,fault,settings,serial}})=>{
  try{
    const began=performance.now();
    const sim=(await WebAssembly.instantiate(module,imports(phase=>self.postMessage({type:'phase',serial,phase})))).exports;
    const errors=sim.engine_build(seed,fault,settings.profile,settings.lights,settings.density,settings.detail);
    if(errors){self.postMessage({type:'rejected',serial,errors,stats:readStats(sim),workerMs:performance.now()-began});return;}
    if(!sim.engine_activate(sim.candidate_id()))throw new Error('Worker could not activate its validated result.');
    self.postMessage({type:'phase',serial,phase:5});
    const start=sim.image_start(),end=Number(sim.__heap_base.value);
    const image=sim.memory.buffer.slice(start,end);
    self.postMessage({type:'complete',serial,start,end,image,stats:readStats(sim),workerMs:performance.now()-began},[image]);
  }catch(error){self.postMessage({type:'error',serial,error:error.message});}
};
