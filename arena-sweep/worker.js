import {imports,readStats} from './base-stats.js';
import {planPacket} from './packets.js';
import {propsMesh} from './mesh.js';
self.onmessage=async({data})=>{try{const {serial}=data;if(data.type==='world'){const sim=(await WebAssembly.instantiate(data.module,imports())).exports,started=performance.now();const errors=sim.engine_build(data.seed,0,data.profile,data.profile===2?48:24,2,1);if(errors||!sim.engine_activate(sim.candidate_id()))throw new Error('Generated arena failed validation: '+errors);const start=sim.image_start(),end=Number(sim.__heap_base.value),image=sim.memory.buffer.slice(start,end);self.postMessage({serial,type:'world',start,end,image,stats:readStats(sim),workerMs:performance.now()-started},[image]);}
 else{const packet=planPacket(data.request),current=propsMesh(data.request.current),next=propsMesh(packet.next,1);self.postMessage({serial,type:'wave',packet,current,next},[current.vertices.buffer,current.indices.buffer,next.vertices.buffer,next.indices.buffer]);}}
 catch(error){self.postMessage({serial:data.serial,type:'error',error:error.message});}};
