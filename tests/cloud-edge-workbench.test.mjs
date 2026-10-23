import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(
  workspace,
  'CloudForge_PaaS_云边协同发布闭环增强版.html',
);
const chromePath =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const smokeScript = `
<script>
const cloudEdgeSmokeErrors=[];
window.addEventListener('error',event=>cloudEdgeSmokeErrors.push(event.message||'window error'));
window.addEventListener('unhandledrejection',event=>cloudEdgeSmokeErrors.push(String(event.reason||'unhandled rejection')));
window.addEventListener('load',()=>setTimeout(()=>{
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  try{
    state.view='cloud-edge';
    state.activeNav='cloud-edge';
    edgeActiveTab='overview';
    render();

    const mount=document.querySelector('.edge-console.edge-fleet-mode');
    check(!!mount,'cloud-edge fleet mode is missing');
    check(!!document.querySelector('.edge-fleet-head'),'compact cloud-edge header is missing');
    check(!!document.querySelector('.edge-fleet-workbench'),'fleet workbench is missing');
    check(!!document.querySelector('.edge-fleet-scope'),'fleet scope list is missing');
    check(!!document.querySelector('.edge-fleet-detail'),'fleet deployment panel is missing');
    check(!!document.querySelector('.edge-fleet-inspector'),'fleet node inspector is missing');
    check(!!document.querySelector('.edge-closure-strip'),'fleet metrics strip is missing');
    check(getComputedStyle(document.querySelector('.edge-hero')).display==='none','legacy hero is still visible');

    const selected=selectedEdgeFleetNode();
    check(!!selected,'no edge node was selected automatically');
    check(edgeSelectedNodeId===selected?.id,'selected edge node is not stored in UI state');
    check(document.querySelector('.edge-fleet-scope-item.is-active')?.dataset.nodeId===selected?.id,'active scope row is missing');
    check(document.querySelector('.edge-fleet-detail')?.textContent.includes(selected?.name||''),'selected node detail is missing');

    const alternate=EDGE_NODES.find(node=>node.id!==selected?.id)||EDGE_NODES[1];
    selectEdgeFleetNode(alternate.id);
    const freshSelected=selectedEdgeFleetNode();
    check(edgeSelectedNodeId===alternate.id,'node selection did not update state');
    check(freshSelected?.id===alternate.id,'node inspection did not follow selection');
    check(document.querySelector('.edge-fleet-detail')?.textContent.includes(alternate.name),'node detail did not update');

    const selector=document.getElementById('edge-fleet-node-select');
    check(!!selector,'narrow-screen node selector is missing');
    check(getComputedStyle(selector).display!=='none','narrow-screen node selector is hidden');
    check(getComputedStyle(document.querySelector('.edge-tabs')).flexWrap==='wrap','cloud-edge tabs do not wrap');
    check(document.documentElement.scrollWidth<=window.innerWidth+2,'cloud-edge workbench causes horizontal page overflow');

    edgeActiveTab='rollout';
    render();
    check(document.getElementById('main')?.textContent.includes('创建协同发布任务'),'legacy rollout tab is no longer reachable');
    edgeActiveTab='nodes';
    render();
    check(getComputedStyle(document.querySelector('.edge-hero')).display==='none','legacy hero returns on node tab');
    check(!!document.querySelector('.edge-fleet-head'),'compact header is missing on node tab');
  }catch(error){
    failures.push(error?.stack||String(error));
  }
  cloudEdgeSmokeErrors.forEach(message=>failures.push('runtime error: '+message));
  const result=document.createElement('pre');
  result.id='cloud-edge-smoke-result';
  result.textContent=failures.length?'FAIL\\n'+failures.join('\\n'):'PASS';
  document.body.appendChild(result);
},300));
</script>`;

test('cloud-edge overview renders as a responsive fleet workbench', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'cloudforge-cloud-edge-'));
  const tempHtml = path.join(tempDir, 'cloud-edge.html');
  try {
    const source = readFileSync(sourcePath, 'utf8');
    writeFileSync(
      tempHtml,
      source.replace('</body>', `${smokeScript}\n</body>`),
      'utf8',
    );
    const result = spawnSync(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-background-networking',
        '--no-first-run',
        '--allow-file-access-from-files',
        '--window-size=900,1100',
        '--virtual-time-budget=2500',
        '--dump-dom',
        pathToFileURL(tempHtml).href,
      ],
      {
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );

    assert.ok(
      result.stdout.includes('id="cloud-edge-smoke-result">PASS</pre>'),
      `cloud-edge browser smoke test failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
