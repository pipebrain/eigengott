// Scene descriptors only. The GPU generates all flat slices by instancing.
export const ENVIRONMENT = [
  [-14,5.7,6.1,6],[-8,5.1,5.6,5.3],[-2.3,5.6,5.4,6],[3.5,5.4,5.5,5.5],[9.4,5.1,5.6,5.3],[15,5.8,5.4,6.5],
  [-14,-5.4,6,5.6],[-7.8,-5.4,5.9,5.7],[-1.5,-5.2,5.8,5.3],[4.8,-5.3,5.7,5.6],[10.8,-5.5,5.5,5.8],[16,-5.4,4.7,6.3],
  [-13,0,4.7,4.8],[13.2,0,4.8,4.9],
  [-20,10,7,6],[-12,11,7,5.6],[-4,11.8,7,6.4],[4.3,11.8,7.4,6.4],[12.4,11,7,6],[20,10,7,7],
  [-20,-11,7,7],[-12,-12,7,6.5],[-4,-12,7,6.5],[4.2,-12,7,6.5],[12,-12,7,7],[20,-11,7,7],
  [-20,2,6,7],[-20,-5,6,6],[20,2,6,7],[20,-5,6,6],
];
export function buildScene(sim, glyphs) {
  sim.clear_scene();
  ENVIRONMENT.forEach(([x,y,w,h],i)=>sim.add_stack(x,y,0,w,h,400+(i%7)*39,0,0,(i*.61803398875)%1));
  const gap=.24,rawWidth=glyphs.reduce((s,g)=>s+g.aspect*3.8,0)+Math.max(0,glyphs.length-1)*gap;
  const scale=Math.min(1,17.5/Math.max(rawWidth,.01));
  const titleWidth=rawWidth*scale,height=3.8*scale;
  let x=-titleWidth/2;
  glyphs.forEach((g,i)=>{
    const width=g.aspect*height;
    sim.add_stack(x+width/2,0,0,width,height,125,1,i,((i+3)*.38196601125)%1);
    x+=width+gap*scale;
  });
  return {count:sim.get_count(),environmentCount:ENVIRONMENT.length,characterCount:glyphs.length,titleWidth,titleHeight:height};
}
