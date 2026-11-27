// Draw once per prepared encounter, then retain that count through validation and Return.
export function chooseCohort(settings,available,random=Math.random){
 if(!settings.botCountRandom)return Math.min(available,settings.botCount);
 const lo=Math.max(1,Math.min(16,Math.round(settings.botCountMin)||1)),hi=Math.max(lo,Math.min(16,Math.round(settings.botCountMax)||7));
 return Math.min(available,lo+Math.floor(Math.max(0,Math.min(.999999999,random()))*(hi-lo+1)));
}
