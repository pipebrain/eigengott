import {originalParameters,conceptOverrides} from './presets.js';
import {dosMazeParameters} from './dos-maze.js';
export const groups=[
  {title:'Playback & cycle',open:true,items:[
    ['autoState','Automatic seesaw','check',true],['manualState','Corruption · 0 stable / 1 chaos','range',0,0,1,.001],
    ['minState','Stable endpoint','range',0,0,1,.01],['maxState','Chaos endpoint','range',1,0,1,.01],
    ['timeScale','Time scale','range',1,0,4,.05,'×'],['period','Full cycle','range',30,6,180,.5,'s'],
    ['stableHold','Stable hold','range',4,0,60,.5,'s'],['chaosHold','Chaos hold','range',2,0,60,.5,'s'],
    ['tectonicMotion','Drift the fixed composition as tectonic plates','check',false],['exactReturn','Restore exact home composition each cycle','check',true],
    ['flickerStateJumps','Hard flicker perturbs corruption state','check',false],['flickerStateAmount','Flicker state disturbance','range',.35,0,.8,.01],
  ]},
  {title:'Maze & linework',items:[
    ['layoutMode','Composition','select','concept',[['concept','Concept-art composition'],['master','Traced vector reference'],['recursive','Original recursive study']]],
    ['layoutInfluence','Concept guide influence','range',.98,0,1,.01],['layoutVariation','Composition variation','range',.04,0,1,.01],
    ['wallWidth','White wall width','range',2.2,1,6,.1,'px'],['pathGap','Black path gap','range',3.8,2,16,.1,'px'],
    ['constantGap','Grid · fixed wall / path spacing','check',true],
    ['gridOriginX','Grid origin X','range',0,-60,60,.5,'px'],['gridOriginY','Grid origin Y','range',0,-60,60,.5,'px'],
    ['allowDiagonal','Allow 45° walls and title hatching','check',false],['diagonalAmount','Diagonal region share','range',.25,0,1,.01],
    ['turnProbability','Turn probability','range',.82,0,1,.01],['branchProbability','Branch splitting probability','range',.025,0,.4,.005],
    ['seed','Seed','number',27011984,1,4294967295,1],['lockSeed','Lock seed · repeatable redraw sequence','check',true],
  ]},
  {title:'Generator mixer',items:[
    ['mixEnabled','Mix generators by region','check',false],
    ['mixContour','Nested contour weight','range',1,0,1,.01],['mixDivision','Recursive division weight','range',.2,0,1,.01],
    ['mixGrowing','Growing Tree weight','range',.1,0,1,.01],['mixSidewinder','Sidewinder weight','range',.1,0,1,.01],
    ['growingNewest','Growing Tree · newest-cell bias','range',.85,0,1,.01],
    ['straightBias','Prefer straight runs','range',.75,0,1,.01],['horizontalBias','Horizontal direction bias','range',.5,0,1,.01],
    ['regionDepth','Region subdivision depth','range',5,2,6,1],['nestedDepth','Contour depth before branching','range',16,2,80,1],
    ['referenceFill','Fill negative-space pockets in reference','check',false],
    ['fillEverywhere','Preserve traced walls · fill every dead zone','check',false],
  ]},
  {title:'Overlap & hierarchy',items:[
    ['preventOverlap','Prevent overlapping line layers','check',true],
    ['collisionEdges','Edges decide visibility on collision','check',false],['collisionRetain','Chance current edge keeps visibility','range',.45,0,1,.01],
    ['collisionHold','Reconsider ongoing contact after','range',1.2,.15,5,.05,'s'],['collisionRedraw','Redraw contacted edge lines','check',true],['edgeBand','Edge redraw band','range',3,1,8,1,'cells'],
    ['hierarchyCycle','Shuffle plate / letter order each cycle','check',true],
    ['hierarchyFlicker','Hard flicker shuffles hierarchy','check',true],['hierarchyChance','Flicker shuffle probability','range',.5,0,1,.01],
    ['hierarchyTrigger','Hierarchy / state flicker source','select','either',[['either','Either layer'],['maze','Maze only'],['title','Title only']]],
    ['hierarchyReturn','Restore original hierarchy at home','check',true],
  ]},
  {title:'Perspective line profile',items:[
    ['lineProfiles','Use separate perspective and fill profiles','check',false],['perspectiveVisible','Show perspective layers','check',true],
    ['perspectiveDepth','Perspective extrusion depth','range',5,.2,12,.1],
    ['vanishingX','Vanishing point X','range',50,0,100,.1,'%'],['vanishingY','Vanishing point Y','range',50,0,100,.1,'%'],
  ]},
  {title:'Fill-plane line profile',items:[
    ['fillPlanesVisible','Show gap-filling planes','check',true],['fillColumns','Fill-plane columns','range',6,2,10,1],['fillRows','Fill-plane rows','range',4,2,8,1],
    ['fillHatchRate','Random hatch direction changes','range',.35,0,3,.05,'Hz'],['fillLineSpeed','Hatch movement speed','range',.4,0,3,.05],['fillJog','Moving line bends','range',.35,0,.8,.01],
  ]},
  {title:'Vector plates & depth',items:[
    ['platesEnabled','Enable drifting vector plates','check',false],['plateDrift','Plate translation','range',1,0,4,.01],
    ['plateScale','Plate expansion / contraction','range',.25,0,1,.01],['plateShear','Stepped plate shear','range',.25,0,1,.01],
    ['plateRotation','Quarter-turn plate rotation','range',.25,0,1,.01],
    ['plateDepth','Depth / parallax separation','range',.6,0,3,.01],['plateOverlap','Plate overlap','range',.2,0,1,.01],
    ['plateCopies','Displaced plate copies','range',.2,0,1,.01],
  ]},
  {title:'Corruption & drifting copies',items:[
    ['driftAmount','Branch displacement','range',1,0,3,.01],['copyDivergence','Copy divergence','range',1,0,4,.01],
    ['breakage','Broken connections','range',.65,0,1,.01],['textDrift','Character drift','range',.65,0,3,.01],
  ]},
  {title:'Title hatching',items:[
    ['referenceHatch','Use traced strokes for reference glyphs','check',true],
    ['titleHatch','Whole-title direction','select','letters',[['letters','Use each letter’s direction'],['0','Vertical'],['1','Horizontal'],['2','45°'],['3','135°']]],
    ['hatchFlickerGlobal','Hard flicker changes whole-title direction','check',false],
    ['hatchFlickerLetters','Hard flicker changes individual letters','check',false],
    ['hatchTrigger','Hatch change trigger','select','title',[['title','Title hard flicker'],['maze','Maze hard flicker'],['either','Either layer’s hard flicker']]],
    ['hatchChance','Whole-title change probability','range',1,0,1,.01],['hatchLetterChance','Per-letter change probability','range',.45,0,1,.01],
    ['hatchSequence','Direction sequence','select','random',[['random','Seeded random · always different'],['cycle','Cycle through allowed directions']]],
  ]},
  {title:'Title & font',items:[
    ['lockTitle','Anchor title · ignore tectonic movement','check',true],
    ['title','Title string','text','EIGENGOTT'],
    ['font','Glyph source','select','gothic',[['gothic','Gothic study · custom outlines'],['reference','Traced reference glyphs'],['serif','Condensed system serif'],['mono','System monospace'],['sans','System sans serif'],['custom','Imported font']]],
    ['titleX','Title position X','range',50,-25,125,.1,'%'],['titleY','Title position Y','range',50,-25,125,.1,'%'],
    ['tracking','Character spacing','range',10.5,-30,80,.5,'ref px'],['titleScale','Title scale','range',1,.15,3,.01],
    ['titleRotation','Glyph mask rotation','range',0,-180,180,.5,'°'],['deadspace','Maze clearance around glyphs','range',0,0,80,1,'px'],
    ['titleGuide','Guide the background flow around the title','check',true],
  ]},
  {title:'Layers & background',items:[
    ['background','Path / background colour','color','#000000'],['mazeVisible','Show maze layer','check',true],['mazeOpacity','Maze opacity','range',1,0,1,.01],
    ['textVisible','Show text layer','check',true],['textOpacity','Text opacity','range',1,0,1,.01],
  ]},
  {title:'Flicker & redraw',items:[
    ['redrawOnFlicker','Redraw maze on hard flicker','check',true],
    ['mazeFlicker','Maze flicker enabled','check',true],['mazeHardAmount','Maze · hard dropout amount','range',1,0,1,.01],
    ['mazeHardRate','Maze · hard flicker frequency','range',.35,0,8,.01,'Hz'],['mazeHardDuration','Maze · dropout duration','range',45,5,400,5,'ms'],
    ['mazeJitter','Maze · irregular timing','range',.65,0,1,.01],['mazePulseAmount','Maze · smooth pulse amount','range',0,0,1,.01],['mazePulseRate','Maze · smooth pulse frequency','range',.65,.05,5,.05,'Hz'],
    ['textFlicker','Title flicker enabled','check',true],['textHardAmount','Title · hard dropout amount','range',1,0,1,.01],
    ['textHardRate','Title · hard flicker frequency','range',.18,0,8,.01,'Hz'],['textHardDuration','Title · dropout duration','range',30,5,400,5,'ms'],
    ['textJitter','Title · irregular timing','range',.75,0,1,.01],['textPulseAmount','Title · smooth pulse amount','range',0,0,1,.01],['textPulseRate','Title · smooth pulse frequency','range',.45,.05,5,.05,'Hz'],
  ]},
  {title:'Performance',items:[
    ['geometryHz','Geometry update rate','range',30,8,60,1,'Hz'],['segmentBudget','Wall segment budget','range',80000,5000,180000,5000],
    ['dprCap','Free-mode render pixel ratio cap','range',1.5,.5,2,.1],['antialias','Antialias white strokes','check',true],
  ]},
];
export const definitions=Object.fromEntries(groups.flatMap(g=>g.items.map(item=>[item[0],item])));
const addedDefaults=()=>Object.fromEntries(Object.values(definitions).map(d=>[d[0],d[3]]));
export const originalDefaults=()=>structuredClone({...addedDefaults(),...originalParameters,preventOverlap:false,lockTitle:false});
export const conceptDefaults=()=>structuredClone({...addedDefaults(),...originalParameters,...conceptOverrides,preventOverlap:false,lockTitle:false});
export const continuousDefaults=()=>({...referenceDefaults(),referenceFill:true});
export const tectonicDefaults=()=>({...continuousDefaults(),tectonicMotion:true,preventOverlap:true,fillEverywhere:true,platesEnabled:true,plateDrift:2.4,plateScale:.55,plateShear:.35,plateRotation:.9,plateDepth:1.2,textDrift:2.2,flickerStateJumps:true});
export const profileDefaults=()=>({...tectonicDefaults(),lockTitle:true,constantGap:true,lineProfiles:true,collisionEdges:true});
export const defaults=()=>structuredClone({...profileDefaults(),...dosMazeParameters});
export function referenceDefaults(){
  const s=conceptDefaults(),boxes=[[319,394],[409,436],[453,536],[548,627],[637,735],[744,823],[833,915],[924,1003],[1003,1076]];
  let x=319;
  return {...s,layoutMode:'master',font:'reference',constantGap:false,wallWidth:2.8,pathGap:3.2,layoutVariation:0,titleX:697.5/1376*100,titleY:385/768*100,tracking:10.25,characters:boxes.map(([a,b])=>{
    const width=b-a,offset=(a+b)/2-(x+width/2);x+=width+10.25;
    return {...characterDefaults(),x:offset};
  })};
}
export function experimentalDefaults(){return {...conceptDefaults(),mixEnabled:true,mixContour:.7,mixDivision:.12,mixGrowing:.08,mixSidewinder:.1,platesEnabled:true};}
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function characterDefaults(){return {x:0,y:0,scaleX:1,scaleY:1,rotation:0,flow:0,opacity:1,hatchFlicker:true,priority:0};}
export function sanitize(raw,hasFont=false,base='concept'){
  const out=base==='original'?originalDefaults():conceptDefaults();
  for(const [key,d]of Object.entries(definitions)){
    const v=raw?.[key];
    if(d[2]==='range'||d[2]==='number'){if(Number.isFinite(v))out[key]=clamp(v,d[4],d[5]);}
    else if(d[2]==='check'){if(typeof v==='boolean')out[key]=v;}
    else if(d[2]==='color'){if(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))out[key]=v;}
    else if(d[2]==='text'){if(typeof v==='string')out[key]=Array.from(v).slice(0,24).join('');}
    else if(d[2]==='select'){if(d[4].some(pair=>pair[0]===v))out[key]=v;}
  }
  if(out.font==='custom'&&!hasFont)out.font='gothic';
  out.seed=Math.round(out.seed);out.segmentBudget=Math.round(out.segmentBudget);out.geometryHz=Math.round(out.geometryHz);
  out.fillColumns=Math.round(out.fillColumns);out.fillRows=Math.round(out.fillRows);
  if(out.minState>out.maxState)[out.minState,out.maxState]=[out.maxState,out.minState];
  if(out.stableHold+out.chaosHold>out.period-.5){const k=(out.period-.5)/(out.stableHold+out.chaosHold);out.stableHold*=k;out.chaosHold*=k;}
  out.characters=(Array.isArray(raw?.characters)?raw.characters:[]).slice(0,24).map(c=>{
    const result=characterDefaults();
    for(const [key,min,max]of [['x',-600,600],['y',-600,600],['scaleX',.1,5],['scaleY',.1,5],['rotation',-180,180],['opacity',0,1],['priority',0,23]])if(Number.isFinite(c?.[key]))result[key]=clamp(c[key],min,max);
    result.flow=Number.isInteger(c?.flow)?clamp(c.flow,0,3):0;
    result.hatchFlicker=c?.hatchFlicker!==false;return result;
  });
  return out;
}
