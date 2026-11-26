const DATABASE='eigengott-vector-library';
export const CURRENT_KEY='eigengott-vector-labyrinth-v2';
export const LEGACY_KEY='eigengott-vector-labyrinth-v1';
export const BEFORE_CONTINUOUS_KEY=CURRENT_KEY+'-before-continuous-default';
export const BEFORE_TECTONIC_KEY=CURRENT_KEY+'-before-tectonic-default';
export const BEFORE_PROFILES_KEY=CURRENT_KEY+'-before-perspective-profiles';
export const BEFORE_DOS_KEY=CURRENT_KEY+'-before-dos-maze';
let database;
export function openLibrary(){
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('presets',{keyPath:'id'});db.createObjectStore('fonts',{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return database;
}
async function operation(store,mode,run){
  const db=await openLibrary();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode),request=run(tx.objectStore(store));let result;
    request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||request.error);tx.onabort=()=>reject(tx.error||new Error('Browser storage transaction was aborted.'));
  });
}
export const getPreset=id=>operation('presets','readonly',s=>s.get(id));
export const listPresets=()=>operation('presets','readonly',s=>s.getAll());
export const putPreset=value=>operation('presets','readwrite',s=>s.put(value));
export const deletePreset=id=>operation('presets','readwrite',s=>s.delete(id));
export const getFont=id=>operation('fonts','readonly',s=>s.get(id));
export async function putFont(name,data){
  const digest=await crypto.subtle.digest('SHA-256',data),id=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const record={id,name,data};await operation('fonts','readwrite',s=>s.put(record));return record;
}
export function encodeFont(font){
  if(!font)return null;
  const bytes=new Uint8Array(font.data),parts=[];
  for(let offset=0;offset<bytes.length;offset+=32768)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));
  return {name:font.name,base64:btoa(parts.join(''))};
}
export function decodeFont(value){
  if(!value||typeof value.name!=='string'||typeof value.base64!=='string')return null;
  const binary=atob(value.base64),data=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)data[i]=binary.charCodeAt(i);
  return {name:value.name,data:data.buffer};
}
