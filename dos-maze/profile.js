// The accepted browser-saved DOS-maze composition, fixed for this runtime.
// Preset provenance: ../vector-labyrinth/presets/dos-maze.json at v1.0.0.
export const VERSION='1.1.1';
export const BUILD='v1.1.1';
export const PROFILE=Object.freeze({seed:27011984,period:30,timeScale:.5,geometryHz:30,
  wallWidth:1,pathGap:16,deadspace:12,tracking:24,titleX:50.6,titleY:50,textDrift:.65,
  mazeHardRate:.35,mazeHardDuration:45,mazeJitter:.65,hierarchyChance:.5,dprCap:1,antialias:false});
export const LETTERS=Object.freeze([
  [1,.96],[7,.85],[14,1.01],[14,1.03],[15,1.09],[15,.94],[17,.99],[15,.95],[3,.92],
].map(Object.freeze));
