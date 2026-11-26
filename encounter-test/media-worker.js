import {calibrate} from './assets.js';
self.onmessage=({data})=>{try{calibrate(data);self.postMessage(data,[data.blob]);}catch(e){self.postMessage({error:e.message});}};
