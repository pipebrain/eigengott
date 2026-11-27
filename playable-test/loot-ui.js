import {itemName} from './equipment.js';import {WEAPONS} from './weapons.js';
import {createLootMotion} from './loot-motion.js';
export function createLootUI({getApp}){
 const root=document.getElementById('loot'),tray=document.getElementById('loot-items'),motion=createLootMotion();let revision=-1,latest=null,raf=0,views=[];
 function frame(){raf=0;if(root.hidden||!latest)return;const app=getApp(),current=app?.lootPresentation()||{time:latest.game.time,items:latest.game.loot.items};views=motion.views(current.items,current.time,innerWidth,innerHeight).map((v,i)=>({...v,label:itemName(current.items[i],WEAPONS)}));for(let i=0;i<views.length;i++){const v=views[i],el=tray.children[i];if(!el)continue;Object.assign(el.style,{left:v.x*100+'%',top:v.y*100+'%',width:v.w*100+'%',height:v.h*100+'%'});}app?.lootViews(views);raf=requestAnimationFrame(frame);}
 function cancel(){cancelAnimationFrame(raf);raf=0;views=[];getApp()?.lootViews([]);}
 function update(d,hidden=false){latest=d;const visible=d.game.loot.visible&&d.sweep.phase==='turn'&&!hidden;root.hidden=!visible;if(!visible){cancel();return;}if(revision!==d.game.loot.revision){revision=d.game.loot.revision;tray.replaceChildren();for(const item of d.game.loot.items){const el=document.createElement('button');el.className='void-loot';el.dataset.item=item.id;el.setAttribute('aria-label','Select '+itemName(item,WEAPONS));el.onclick=()=>{const app=getApp();if(app?.loot(item.id)){cancel();root.hidden=true;}};tray.append(el);}}if(!raf)frame();}
 window.addEventListener('blur',()=>{getApp()?.actions(0);});return {update,cancel};
}
