// Hosting-only metadata and an explicit tools URL; gameplay remains unchanged.
const build=globalThis.__EIGENGOTT_BUILD;
function attach(){
  const controls=document.getElementById('controls');if(!controls)return;
  if(build){
    const line=document.createElement('p');line.className='hint';line.dataset.deploymentBuild=build.commit;line.style.cssText='font-size:11px;padding-top:8px;letter-spacing:0';
    const commit=document.createElement('a');commit.href=`${build.repository}/commit/${build.commit}`;commit.textContent=`Build ${build.short}`;commit.style.color='inherit';
    const home=document.createElement('a');home.href=new URL('./tests.html',import.meta.url).href;home.textContent='All tests';home.style.color='inherit';
    line.append(commit,document.createTextNode(' · '),home);(controls.querySelector('footer')||controls).append(line);
  }
  if(new URLSearchParams(location.search).has('tools')&&controls.hidden){
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'h',code:'KeyH',bubbles:true}));
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
