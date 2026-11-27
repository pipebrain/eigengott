const build=globalThis.__EIGENGOTT_BUILD;
if(build){
  const link=document.createElement('a');link.href=`${build.repository}/commit/${build.commit}`;link.textContent=`Build ${build.short}`;
  document.getElementById('build').replaceChildren(link,document.createTextNode(` · ${new Date(build.builtAt).toISOString().slice(0,10)}`));
  for(const node of document.querySelectorAll('[data-current-version]'))node.textContent='v'+build.version;
}
document.getElementById('capability').textContent=navigator.gpu
  ?'WebGPU API available. Open a test to check GPU access.'
  :'WebGPU is unavailable in this browser. The playable tests require a WebGPU-capable browser and device.';
