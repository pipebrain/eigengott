// Draw once per prepared encounter, then retain that count through validation and Return.
export function chooseCohort(settings,available,random=Math.random){
 if(!settings.botCountRandom)return Math.min(available,settings.botCount);
 const lo=Math.max(1,Math.min(16,Math.round(settings.botCountMin)||1)),hi=Math.max(lo,Math.min(16,Math.round(settings.botCountMax)||7));
 return Math.min(available,lo+Math.floor(Math.max(0,Math.min(.999999999,random()))*(hi-lo+1)));
}
export const WORKLOAD_RANGES=Object.freeze([[1,3],[3,7],[3,15]].map(Object.freeze));
export function chooseArena(settings,available,currentProfile=settings.profile,newArena=true,random=Math.random){const profile=settings.randomWorkload&&newArena?Math.min(2,Math.floor(random()*3)):currentProfile;if(!settings.randomWorkload)return {botCount:chooseCohort(settings,available,random)};const [botCountMin,botCountMax]=WORKLOAD_RANGES[profile],next={...settings,botCountRandom:true,botCountMin,botCountMax};return {profile,botCountMin,botCountMax,botCountRandom:true,botCount:chooseCohort(next,available,random)};}
