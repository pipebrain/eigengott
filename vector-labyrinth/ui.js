import {groups,definitions,defaults,profileDefaults,tectonicDefaults,continuousDefaults,conceptDefaults,originalDefaults,referenceDefaults,experimentalDefaults,sanitize,characterDefaults} from './settings.js';
import {CURRENT_KEY,LEGACY_KEY,BEFORE_CONTINUOUS_KEY,BEFORE_TECTONIC_KEY,BEFORE_PROFILES_KEY,BEFORE_DOS_KEY,openLibrary,listPresets,getPreset,putPreset,deletePreset,getFont,putFont,encodeFont,decodeFont} from './storage.js';
const DEFAULT_PRESET='builtin:dos-maze',DEFAULT_REVISION=4;
export function makeUI(onChange){
  let settings=defaults(),customFont=null,fontRecord=null,selected=0,operationId=0,runtimeProvider=()=>null,pendingRuntime=null;
  let savedPresets=[],activePreset=DEFAULT_PRESET;
  let current=null;try{current=JSON.parse(localStorage.getItem(CURRENT_KEY)||'null');if(current?.settings)settings=sanitize(current.settings,current.settings.font==='custom');}catch{}
  const controls=document.querySelector('#controls'),root=document.querySelector('#groups'),inputs=new Map(),outputs=new Map();
  const presetStatus=document.querySelector('#preset-status'),browserSelect=document.querySelector('#browser-preset');
  const notify=message=>{presetStatus.textContent=message;};
  function save(){try{localStorage.setItem(CURRENT_KEY,JSON.stringify({version:2,defaultRevision:DEFAULT_REVISION,settings,fontId:settings.font==='custom'?fontRecord?.id:null,activePreset}));}catch{notify('Browser autosave is unavailable. Export JSON to keep this setup.');}}
  async function activateFont(asset,serial){
    const face=new FontFace('LabyrinthImported',asset.data,{weight:'900'});await face.load();if(serial!==operationId)return false;
    let stored=asset;
    if(!asset.id){try{stored=await putFont(asset.name,asset.data);}catch{stored={...asset,id:null};}}
    if(serial!==operationId)return false;
    if(customFont)document.fonts.delete(customFont);customFont=face;fontRecord=stored;document.fonts.add(face);
    inputs.get('font').querySelector('[value=custom]').disabled=false;
    document.querySelector('#font-status').textContent=asset.name+(stored.id?' · saved in this browser':' · available for this session');return true;
  }
  function format(d,value){const unit=d[7]||'';if(unit==='×')return `×${value.toFixed(2)}`;return `${Number.isInteger(value)?value:value.toFixed(d[6]<.01?3:2)}${unit?' '+unit:''}`;}
  function makeInput(d,parent,change){
    const [name,label,type,value,min,max,step]=d;
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement(type==='select'?'select':'input');input.id=name;
    if(type==='select')for(const [value,text]of min){const o=new Option(text,value);if(value==='custom')o.disabled=!customFont;input.add(o);}
    else input.type=type==='range'?'range':type==='check'?'checkbox':type;
    if(type==='range'||type==='number'){input.min=min;input.max=max;input.step=step;}
    if(type==='check'){wrapper.className='check';wrapper.prepend(input);}
    else{
      if(type==='range'){const output=document.createElement('output');output.id=name+'-value';wrapper.append(output);outputs.set(name,{output,d});}
      wrapper.append(input);
    }
    if(type==='text')input.maxLength=48;
    input.addEventListener('input',()=>change(type==='check'?input.checked:type==='range'||type==='number'?+input.value:input.value));
    parent.append(wrapper);inputs.set(name,input);return input;
  }
  for(const group of groups){
    const section=document.createElement('details');section.open=!!group.open;
    const summary=document.createElement('summary');summary.textContent=group.title;section.append(summary);root.append(section);
    for(const d of group.items){
      if(d[0]==='mazeFlicker'||d[0]==='textFlicker'){const heading=document.createElement('h2');heading.className='subhead';heading.textContent=d[0]==='mazeFlicker'?'MAZE LAYER':'TEXT LAYER';section.append(heading);}
      makeInput(d,section,value=>{
        settings[d[0]]=d[0]==='title'?Array.from(value).slice(0,24).join(''):value;
        if(d[0]==='manualState')settings.autoState=false;
        if(d[0]==='period'||d[0]==='stableHold'||d[0]==='chaosHold'){
          if(d[0]!=='period')settings.period=Math.min(180,Math.max(settings.period,settings.stableHold+settings.chaosHold+.5));
        }
        settings=sanitize(settings,!!customFont);sync();save();onChange(d[0]);
      });
    }
    if(group.title==='Maze & linework'){
      const button=document.createElement('button');button.id='regenerate';button.textContent='Regenerate maze';button.onclick=()=>onChange('regenerate');section.append(button);
      const p=document.createElement('p');p.className='hint';p.textContent='Exact animated-grid mode builds complete wall pairs, rather than just rounding endpoints. Free-gap mode retains source spacing.';section.append(p);
      const referenceHint=document.createElement('p');referenceHint.className='hint';referenceHint.textContent='Grid pitch = wall width + path gap. Layer visibility and collision redraws resolve on grid cells. Strict mode uses native-pixel rendering to preserve spacing.';section.append(referenceHint);
    }
    if(group.title==='Overlap & hierarchy'){
      const hint=document.createElement('p');hint.className='hint';hint.textContent='Contacted edges decide visibility and redraw their line ends. Ongoing contacts are reconsidered after the hold time. Letters always sit above the maze.';section.append(hint);
    }
    if(group.title==='Title & font'){
      section.after(document.querySelector('#character-panel'));
      const label=document.createElement('label');label.textContent='Import a local font';const file=document.createElement('input');file.id='font-file';file.type='file';file.accept='.ttf,.otf,.woff,.woff2';label.append(file);section.append(label);
      const status=document.createElement('p');status.id='font-status';status.className='hint';status.setAttribute('role','status');status.textContent='TTF / OTF / WOFF / WOFF2 · stays on this device';section.append(status);
      file.onchange=async()=>{
        const source=file.files[0];if(!source)return;const serial=++operationId;status.textContent='Loading font…';
        try{if(!await activateFont({name:source.name,data:await source.arrayBuffer()},serial))return;settings.font='custom';sync();save();onChange('font');}
        catch{if(serial===operationId)status.textContent='Could not load this font. The previous glyphs remain active.';}
      };
    }
  }
  const characterDefs=[['char-x','Offset X','range',0,-600,600,1,'px'],['char-y','Offset Y','range',0,-600,600,1,'px'],['char-scaleX','Scale X','range',1,.1,5,.01],['char-scaleY','Scale Y','range',1,.1,5,.01],['char-rotation','Mask rotation','range',0,-180,180,.5,'°'],['char-opacity','Opacity','range',1,0,1,.01],['char-priority','Base priority · higher draws on top','range',0,0,23,1],['char-flow','Hatch direction','select',0,[['0','Vertical'],['1','Horizontal'],['2','45°'],['3','135°']]],['char-hatchFlicker','Allow this letter’s flicker hatch changes','check',true]];
  const characterInputs=document.querySelector('#character-inputs'),selector=document.querySelector('#character-select');
  for(const d of characterDefs)makeInput(d,characterInputs,value=>{
    if(!settings.characters[selected])settings.characters[selected]=characterDefaults();settings.characters[selected][d[0].slice(5)]=d[2]==='check'?value:+value;syncCharacter();save();onChange(d[0]==='char-flow'?'characterFlow':'character');
  });
  selector.onchange=()=>{selected=+selector.value;syncCharacter();};
  document.querySelector('#character-reset').onclick=()=>{settings.characters[selected]=characterDefaults();syncCharacter();save();onChange('character');};
  function syncCharacter(){
    const chars=Array.from(settings.title);if(selector.options.length!==chars.length||Array.from(selector.options).some((o,i)=>o.dataset.char!==chars[i])){
      selector.replaceChildren();chars.forEach((char,i)=>{const option=new Option(`${i+1} · ${char===' '?'[space]':char}`,i);option.dataset.char=char;selector.add(option);});selected=Math.max(0,Math.min(selected,chars.length-1));
    }
    selector.value=selected;document.querySelector('#character-fields').disabled=!chars.length;
    const c={...characterDefaults(),...settings.characters[selected]};
    for(const d of characterDefs){const value=c[d[0].slice(5)],input=inputs.get(d[0]);if(d[2]==='check')input.checked=value;else input.value=value;const o=outputs.get(d[0]);if(o)o.output.value=format(d,value);}
    for(const id of ['titleHatch','char-flow'])for(const o of inputs.get(id).options)if(o.value==='2'||o.value==='3')o.disabled=!settings.allowDiagonal;
  }
  function sync(){
    for(const [name,d]of Object.entries(definitions)){const input=inputs.get(name);if(d[2]==='check')input.checked=settings[name];else input.value=settings[name];const o=outputs.get(name);if(o)o.output.value=format(d,settings[name]);}
    syncCharacter();
  }
  function toggle(){controls.hidden=!controls.hidden;}
  document.querySelector('#close').onclick=()=>controls.hidden=true;
  const builtins={
    'builtin:dos-maze':{name:'Default · dos-maze',settings:()=>defaults()},
    'builtin:reference-filled':{name:'Previous default · perspective + fill planes',settings:()=>profileDefaults()},
    'builtin:tectonic-v5':{name:'Previous tectonic default · v5',settings:()=>tectonicDefaults()},
    'builtin:continuous-v4':{name:'Previous continuous-field default · v4',settings:()=>continuousDefaults()},
    'builtin:concept':{name:'Previous concept default · constant gaps',settings:()=>conceptDefaults()},
    'builtin:reference':{name:'Traced vector reference · source spacing',settings:()=>referenceDefaults()},
    'builtin:experimental':{name:'Mixed generators + drifting plates',settings:()=>experimentalDefaults()},
    'builtin:original':{name:'Original study · before concept tuning',settings:()=>originalDefaults()},
  };
  async function refreshPresets(selectedId=activePreset){
    savedPresets=(await listPresets()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));browserSelect.replaceChildren();
    const bundled=document.createElement('optgroup');bundled.label='Built-in';
    for(const [id,p]of Object.entries(builtins))bundled.append(new Option(p.name,id));browserSelect.append(bundled);
    if(savedPresets.length){const local=document.createElement('optgroup');local.label='Saved in this browser';for(const p of savedPresets)local.append(new Option(p.name,p.id));browserSelect.append(local);}
    browserSelect.value=Array.from(browserSelect.options).some(o=>o.value===selectedId)?selectedId:DEFAULT_PRESET;
    document.querySelector('#browser-delete').disabled=!!builtins[browserSelect.value];
  }
  function capture(){
    return {format:'eigengott-vector-labyrinth',version:2,name:document.querySelector('#preset-name').value.trim()||'EIGENGOTT setup',settings:structuredClone(settings),fontId:settings.font==='custom'?fontRecord?.id:null,runtime:document.querySelector('#save-pose').checked?runtimeProvider():null};
  }
  async function applyRecord(record,message,id=''){
    if(!record?.settings||![1,2].includes(record.version))throw new Error('Invalid preset');
    const serial=++operationId;
    let missingFont=false;
    if(record.settings.font==='custom'){
      const asset=record.font?decodeFont(record.font):record.fontId?await getFont(record.fontId):null;
      if(asset){if(!await activateFont(asset,serial))return;}
      else if(!customFont)missingFont=true;
    }
    if(serial!==operationId)return;
    settings=sanitize(record.settings,!!customFont,record.version===1?'original':'concept');
    activePreset=id||'imported';pendingRuntime=record.runtime||null;sync();save();onChange('preset');
    if(record.name)document.querySelector('#preset-name').value=record.name;
    notify(message+(missingFont?' Import the font file to restore its custom glyphs.':''));
  }
  browserSelect.onchange=()=>{document.querySelector('#browser-delete').disabled=!!builtins[browserSelect.value];};
  document.querySelector('#browser-save').onclick=async()=>{
    try{
      const record=capture(),name=document.querySelector('#preset-name').value.trim()||`Saved ${new Date().toLocaleString()}`;
      const existing=savedPresets.find(p=>p.name.toLowerCase()===name.toLowerCase());
      const id=existing?.id||crypto.randomUUID(),value={...record,id,name,updatedAt:Date.now()};
      await putPreset(value);activePreset=id;document.querySelector('#preset-name').value=name;save();await refreshPresets(id);notify(`Saved “${name}” in this browser.`);
    }catch{notify('Could not save in this browser. Export JSON to keep the setup.');}
  };
  document.querySelector('#browser-load').onclick=async()=>{
    try{
      const id=browserSelect.value,preset=builtins[id];
      const record=preset?{version:2,name:preset.name,settings:preset.settings()}:await getPreset(id);
      await applyRecord(record,`Loaded “${record.name}”.`,id);
    }catch{notify('Could not load this saved setup.');}
  };
  document.querySelector('#browser-delete').onclick=async()=>{
    const id=browserSelect.value;if(builtins[id])return;
    try{await deletePreset(id);await refreshPresets(DEFAULT_PRESET);notify('Deleted the browser save. Current controls were kept.');}catch{notify('Could not delete this browser save.');}
  };
  document.querySelector('#export').onclick=()=>{
    const record=capture();delete record.fontId;
    if(settings.font==='custom'&&fontRecord)record.font=encodeFont(fontRecord);
    const data=JSON.stringify(record,null,2);
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='eigengott-labyrinth-preset.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Exported JSON'+(record.font?' including the imported font.':'.'));
  };
  const preset=document.querySelector('#preset-file');document.querySelector('#import').onclick=()=>preset.click();
  preset.onchange=async()=>{const file=preset.files[0];if(!file)return;try{const value=JSON.parse(await file.text());if(value.format!=='eigengott-vector-labyrinth')throw new Error();await applyRecord(value,'Imported preset'+(value.font?' and its font.':'.'));}catch{notify('This preset could not be loaded. Current controls were kept.');}preset.value='';};
  async function resetTo(id){const p=builtins[id];try{await applyRecord({version:2,name:p.name,settings:p.settings()},`Restored “${p.name}”.`,id);browserSelect.value=id;browserSelect.onchange();}catch{notify('Could not restore this built-in preset.');}}
  document.querySelector('#reset').onclick=()=>resetTo(DEFAULT_PRESET);
  document.querySelector('#concept-reset').onclick=()=>resetTo('builtin:concept');
  document.querySelector('#original-reset').onclick=()=>resetTo('builtin:original');
  sync();
  const ready=(async()=>{
    try{
      await openLibrary();
      if(current?.settings&&!(current.defaultRevision>=DEFAULT_REVISION)){
        // Switch existing installations once, keeping their exact autosave and
        // font link available before the new opening preset is written.
        const dos=current.defaultRevision>=3,profiles=current.defaultRevision>=2,tectonic=current.defaultRevision>=1,key=dos?BEFORE_DOS_KEY:profiles?BEFORE_PROFILES_KEY:tectonic?BEFORE_TECTONIC_KEY:BEFORE_CONTINUOUS_KEY,id=dos?'before-dos-maze':profiles?'before-perspective-profiles':tectonic?'before-tectonic-default':'before-continuous-default';
        if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(current));
        if(!await getPreset(id))await putPreset({...current,id,name:dos?'Before dos-maze · previous browser options':profiles?'Before perspective profiles · previous browser options':tectonic?'Before tectonic animation · previous browser options':'Before continuous-field default · previous browser options',version:2,updatedAt:Date.now()});
        settings=defaults();activePreset=DEFAULT_PRESET;save();notify('dos-maze is now the default. Previous browser options were saved in the library.');
      }else if(!current){
        const legacy=localStorage.getItem(LEGACY_KEY);
        if(legacy&&!await getPreset('before-concept-default'))await putPreset({id:'before-concept-default',name:'Before concept default · previous browser options',version:1,settings:sanitize(JSON.parse(legacy),false,'original'),updatedAt:Date.now()});
        settings=defaults();save();
      }else{
        activePreset=current.activePreset||DEFAULT_PRESET;
        if(current.settings.font==='custom'){
          const asset=current.fontId?await getFont(current.fontId):null;
          if(asset)await activateFont(asset,++operationId);else{settings.font='gothic';notify('Saved options restored. Import the custom font to restore its glyphs.');}
        }
        settings=sanitize(settings,!!customFont);
      }
      sync();await refreshPresets(activePreset);
    }catch{settings=sanitize(settings,!!customFont);sync();notify('Browser library is unavailable. JSON export/import still works.');}
  })();
  return {get settings(){return settings;},ready,sync,save,toggle,setRuntimeProvider(fn){runtimeProvider=fn;},takeRuntime(){const value=pendingRuntime;pendingRuntime=null;return value;},set(values,persist=true){settings=sanitize({...settings,...values},!!customFont);sync();if(persist)save();},live(state,paused){document.querySelector('#live-state').textContent=`${paused?'Paused · ':''}${state<.01?'Stable':state>.99?'Chaos':'Drifting'} · ${state.toFixed(3)}`;}};
}
