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
const sidebarSmokeErrors=[];
window.addEventListener('error',event=>sidebarSmokeErrors.push(event.message||'window error'));
window.addEventListener('unhandledrejection',event=>sidebarSmokeErrors.push(String(event.reason||'unhandled rejection')));
window.addEventListener('load',()=>setTimeout(()=>{
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  try{
    state.view='apps';
    state.activeNav='apps';
    render();
    const cloudParent=document.querySelector('[data-nav-id="cloud-edge"]');
    const cloudMenu=document.querySelector('[data-submenu="cloud-edge"]');
    check(!!cloudParent,'cloud-edge expandable parent is missing');
    check(!!cloudMenu,'cloud-edge submenu is missing');
    check(cloudMenu.querySelectorAll('.nav-subitem').length===7,'cloud-edge submenu does not contain seven items');
    check(!cloudMenu.classList.contains('open'),'cloud-edge submenu should start collapsed');

    toggleSidebarGroup('cloud-edge');
    check(document.querySelector('[data-submenu="cloud-edge"]')?.classList.contains('open'),'cloud-edge submenu did not open');
    check(document.querySelector('[data-nav-id="cloud-edge"] .nav-toggle')?.getAttribute('aria-expanded')==='true','cloud-edge aria-expanded did not update');

    goSidebarChild('cloud-edge','nodes');
    check(state.view==='cloud-edge'&&edgeActiveTab==='nodes','cloud-edge child did not update page state');
    check(document.querySelector('[data-submenu="cloud-edge"] .nav-subitem.active')?.dataset.childId==='nodes','cloud-edge active child is missing');
    check(document.querySelector('[data-nav-id="cloud-edge"]')?.classList.contains('active'),'cloud-edge parent is not active');
    check(getComputedStyle(document.querySelector('.edge-tabs')).display==='none','cloud-edge duplicate desktop tabs are still visible');

    toggleSidebarGroup('gateway');
    check(document.querySelector('[data-submenu="gateway"]')?.classList.contains('open'),'gateway submenu did not open');
    check(!document.querySelector('[data-submenu="cloud-edge"]')?.classList.contains('open'),'multiple sidebar groups remained open');
    goSidebarChild('gateway','traffic');
    check(state.view==='gateway'&&state.gatewayTab==='traffic','gateway child did not update page state');
    check(document.querySelector('[data-submenu="gateway"] .nav-subitem.active')?.dataset.childId==='traffic','gateway active child is missing');
    check(getComputedStyle(document.querySelector('.gateway-detail-tabs')).display==='none','gateway duplicate desktop tabs are still visible');

    goNav('cloud-edge');
    check(state.view==='cloud-edge'&&edgeActiveTab==='overview','parent navigation did not open cloud-edge overview');
    check(document.querySelector('[data-submenu="cloud-edge"]')?.classList.contains('open'),'parent navigation did not expand cloud-edge');
    check(!document.querySelector('[data-submenu="gateway"]')?.classList.contains('open'),'parent navigation left gateway expanded');
  }catch(error){
    failures.push(error?.stack||String(error));
  }
  sidebarSmokeErrors.forEach(message=>failures.push('runtime error: '+message));
  const result=document.createElement('pre');
  result.id='sidebar-smoke-result';
  result.textContent=failures.length?'FAIL\\n'+failures.join('\\n'):'PASS';
  document.body.appendChild(result);
},300));
</script>`;

test('sidebar exposes accordion subnavigation for cloud-edge and gateway', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'cloudforge-sidebar-'));
  const tempHtml = path.join(tempDir, 'sidebar.html');
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
        '--window-size=1200,1100',
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
      result.stdout.includes('id="sidebar-smoke-result">PASS</pre>'),
      `sidebar browser smoke test failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
