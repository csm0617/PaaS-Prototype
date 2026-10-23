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
const gatewaySmokeErrors=[];
window.addEventListener('error',event=>gatewaySmokeErrors.push(event.message||'window error'));
window.addEventListener('unhandledrejection',event=>gatewaySmokeErrors.push(String(event.reason||'unhandled rejection')));
window.addEventListener('load',()=>setTimeout(()=>{
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  try{
    state.view='gateway';
    state.activeNav='gateway';
    render();
    const workbench=document.querySelector('.gateway-workbench');
    check(!!workbench,'gateway workbench is missing');
    check(!!document.querySelector('.gateway-route-panel'),'gateway route master panel is missing');
    check(!!document.querySelector('.gateway-detail-panel'),'gateway route detail panel is missing');
    const app=selectedGatewayApp();
    const route=selectedGatewayRoute(app);
    check(!!route,'no gateway route was selected automatically');
    check(state.gatewayRouteId===route?.id,'selected route is not stored in UI state');
    check(document.querySelector('.gateway-route-item.is-active')?.dataset.routeId===route?.id,'active route row is missing');
    check(document.querySelector('.gateway-detail-panel')?.textContent.includes(route?.host||''),'selected route detail does not show its host');
    check(!!document.querySelector('.gateway-detail-tabs'),'gateway detail tabs are missing');

    setGatewayWorkspaceTab('traffic');
    check(!!document.getElementById('traffic-enabled'),'traffic policy tab did not render its controls');
    setGatewayWorkspaceTab('checks');
    check(document.querySelector('.gateway-detail-panel')?.textContent.includes('配置检查'),'validation tab did not render');
    setGatewayWorkspaceTab('route');

    const second={...route,id:'route-smoke-second',name:'Smoke 路由',host:'smoke.acme.io',path:'/smoke',enabled:true};
    app.routes.push(second);
    selectGatewayRoute(second.id);
    check(state.gatewayRouteId===second.id,'route selection did not update state');
    check(document.querySelector('.gateway-detail-panel')?.textContent.includes('smoke.acme.io'),'route selection did not update detail');

    const currentWorkbench=document.querySelector('.gateway-workbench');
    const columns=getComputedStyle(currentWorkbench).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean);
    check(columns.length===1,\`gateway workbench did not stack into one column at narrow width (\${getComputedStyle(currentWorkbench).gridTemplateColumns}; viewport \${window.innerWidth})\`);
    check(document.documentElement.scrollWidth<=window.innerWidth+2,'gateway workbench causes horizontal page overflow');
  }catch(error){
    failures.push(error?.stack||String(error));
  }
  gatewaySmokeErrors.forEach(message=>failures.push('runtime error: '+message));
  const result=document.createElement('pre');
  result.id='gateway-smoke-result';
  result.textContent=failures.length?'FAIL\\n'+failures.join('\\n'):'PASS';
  document.body.appendChild(result);
},300));
</script>`;

test('gateway page renders as a responsive master-detail workbench', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'cloudforge-gateway-'));
  const tempHtml = path.join(tempDir, 'gateway.html');
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
      result.stdout.includes('id="gateway-smoke-result">PASS</pre>'),
      `gateway browser smoke test failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
