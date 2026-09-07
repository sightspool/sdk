(async () => {
  const status=document.getElementById('status'), events=document.getElementById('events');
  const realFetch=window.fetch.bind(window);let count=0, log=[], identityLeaked=false, timer;
  const show=(entry)=>{log.unshift(entry);log=log.slice(0,10);events.textContent=log.join('\n\n');};
  try {
    const response=await realFetch('release.json',{credentials:'omit',cache:'no-store'});
    if(!response.ok) throw Error('Release manifest unavailable');
    const manifest=await response.json();
    if(!/^[a-f0-9]{64}$/.test(manifest.artifactId)||!/^\d+\.\d+\.\d+$/.test(manifest.version)||!/^[a-f0-9]{64}$/.test(manifest.bundle.sha256)||manifest.bundle.path!==`releases/${manifest.version}/${manifest.artifactId}/sdk.global.js`||!/^sha384-[A-Za-z0-9+/]{64}$/.test(manifest.bundle.integrity)) throw Error('Invalid release manifest');
    window.fetch=async (url,input)=>{
      if(String(url)!=='https://demo.sightspool.invalid/widget-offer') return realFetch(url,input);
      const body=JSON.parse(input.body);count++;identityLeaked ||= input.body.includes('demo-private-user');
      show('SIMULATED POST /widget-offer\n'+JSON.stringify({...body,device:'[random session identifier redacted]'},null,2));
      document.getElementById('summary').textContent=`${count} simulated offer requests · test user ID in payload: ${identityLeaked?'YES':'no'}`;
      return new Response(JSON.stringify({available:true,offer:'synthetic-demo-not-a-valid-offer'}),{headers:{'Content-Type':'application/json'}});
    };
    window.open=()=>{show('SIMULATED HANDOFF: the real flow opens consent and eligibility review. No interview opened.');return null;};
    const script=document.createElement('script');script.src=manifest.bundle.path;script.integrity=manifest.bundle.integrity;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Bundle failed to load or integrity did not match'));document.body.appendChild(script);});
    const sdk=window.Sightspool;
    const start=(audience)=>sdk.init({key:'11111111-1111-4111-8111-111111111111',endpoint:'https://demo.sightspool.invalid',audience});
    const actions={visitors:()=>start('all_visitors'),members:()=>start('signed_in'),login:()=>sdk.identify('demo-private-user'),logout:()=>sdk.identify(null),pause:()=>sdk.pause(),resume:()=>sdk.resume(),destroy:()=>sdk.destroy()};
    document.querySelectorAll('[data-action]').forEach(button=>{button.disabled=false;button.onclick=actions[button.dataset.action];});
    const update=()=>{const text=`SDK status: ${sdk.getStatus()}`;if(status.textContent!==text)status.textContent=text;};update();timer=setInterval(update,250);
    window.addEventListener('pagehide',()=>{clearInterval(timer);sdk.destroy();},{once:true});
  } catch(error) { status.textContent=`Demo unavailable: ${error.message}. No invitation was started.`; }
})();
