(async () => {
  const status = document.getElementById('release-status');
  try {
    const response = await fetch('release.json', {cache:'no-store', credentials:'omit'});
    if (!response.ok) throw Error();
    const release = await response.json();
    if (!/^[a-f0-9]{64}$/.test(release.artifactId) || !/^\d+\.\d+\.\d+$/.test(release.version) || !/^[a-f0-9]{64}$/.test(release.bundle.sha256) || release.bundle.path !== `releases/${release.version}/${release.artifactId}/sdk.global.js`) throw Error();
    status.textContent = `Review build ${release.version} · ${release.sourceDirty ? 'uncommitted source changes' : 'source snapshot recorded'}. Publication status must be checked separately.`;
    const metrics = document.getElementById('release-metrics');
    for (const [label,value] of [['Bundle',`${release.bundle.bytes.toLocaleString()} bytes · ${release.bundle.gzipBytes.toLocaleString()} bytes gzip`],['Runtime dependencies',String(release.runtimeDependencies.length)],['Source commit',release.sourceCommit]]) {
      const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value;dd.className='hash';metrics.append(dt,dd);
    }
    const directory=release.bundle.path.slice(0,release.bundle.path.lastIndexOf('/')+1);
    const links=document.getElementById('release-links');
    for(const [label,path] of [['Download bundle',release.bundle.path],['Source snapshot',directory+'source.json'],['Release manifest',directory+'release.json']]) {
      const a=document.createElement('a');a.href=path;a.textContent=label;links.append(a,document.createTextNode(' · '));
    }
    document.getElementById('release-json').textContent=JSON.stringify(release,null,2);
  } catch { status.textContent='Release files are unavailable. Build the SDK documentation or check back after publication; no verified download is being offered here.'; }
})();
