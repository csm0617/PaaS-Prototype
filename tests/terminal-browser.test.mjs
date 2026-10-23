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
const terminalSmokeErrors=[];
window.addEventListener('error',event=>terminalSmokeErrors.push(event.message||'window error'));
window.addEventListener('unhandledrejection',event=>terminalSmokeErrors.push(String(event.reason||'unhandled rejection')));
window.addEventListener('load',()=>setTimeout(()=>{
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  try{
    const controller=window.CloudForgeTerminalApp;
    check(!!controller,'terminal application controller is missing');
    check(typeof window.terminateTerminalSession==='function','administrator terminal termination entry is missing');
    if(controller){
      const app=getApp('trade')||APPS[0];
      const row=getReleaseWorkloadRows(app)[0];
      check(!!row,'no workload is available for terminal smoke test');
      if(row){
        const podTarget=controller.targetForWorkload(row.id,0);
        const podSession=controller.createSession(podTarget,{actor:'张明',role:'operator',reason:'pod diagnostics'});
        check(podSession.ok===true,'pod terminal session was rejected');
        check(podSession.session?.status==='active','pod terminal session is not active');
        const version=controller.runCommand(podSession.session.id,'cat /app/version');
        check(version.ok===true,'pod terminal command failed');
        check(String(version.output||'').includes(imageVersionTag(row.workload.image)),'pod terminal output has no workload version');
        const blocked=controller.runCommand(podSession.session.id,'rm -rf /');
        check(blocked.blocked===true,'dangerous command was not blocked');
        check(String(blocked.output||'').includes('blocked'),'blocked command has no policy message');
        check(blocked.session?.commands?.length===2,'command recording is incomplete');
        controller.endSession(podSession.session.id,'smoke complete');
        check(controller.getSession(podSession.session.id).status==='ended','terminal session did not end');
      }

      const edgeTarget=controller.targetForEdgeNode('edge-tokyo-01');
      const edgeSession=controller.createSession(edgeTarget,{actor:'张明',role:'admin',reason:'edge diagnosis'});
      check(edgeSession.session?.status==='active','edge terminal session is not active');
      const edgeStatus=controller.runCommand(edgeSession.session.id,'edge-agent status');
      check(String(edgeStatus.output||'').includes('online'),'edge terminal did not return agent state');
      EDGE_NODES.find(node=>node.id==='edge-tokyo-01').status='offline';
      const offlineEdge=controller.runCommand(edgeSession.session.id,'edge-agent status');
      check(offlineEdge.blocked===true,'terminal command continued after edge node went offline');
      check(offlineEdge.audit?.result==='target-unavailable','offline edge command was not audited');
      EDGE_NODES.find(node=>node.id==='edge-tokyo-01').status='online';

      const cloudTarget=controller.targetForCloudNode('worker-01');
      const cloudPending=controller.createSession(cloudTarget,{actor:'李强',role:'operator',reason:'service restart'});
      check(cloudPending.session?.status==='awaiting_approval','operator cloud terminal did not require approval');
      const approved=controller.approveSession(cloudPending.session.id,{actor:'管理员',role:'admin',reason:'approved'});
      check(approved.ok===true&&approved.session?.status==='active','cloud terminal approval did not activate session');
      const host=controller.runCommand(cloudPending.session.id,'hostname');
      check(String(host.output||'').includes('worker-01'),'cloud terminal hostname output is incorrect');

      const loginTarget=controller.targetForEdgeNode('edge-osaka-01');
      controller.openLogin(loginTarget);
      check(document.getElementById('modal-root')?.textContent.includes('终端登录'),'terminal login dialog is missing');

      state.view='terminals';
      state.activeNav='terminals';
      render();
      check(document.getElementById('main')?.textContent.includes('终端会话'),'terminal sessions page is missing');
      check(localStorage.getItem('cloudforge-terminal-sessions-v1'),'terminal sessions were not persisted');

      if(row){
        state.appId=app.id;
        state.workloadId=row.id;
        state.view='workload';
        render();
        check(!!document.getElementById('terminal-workload-entry'),'workload terminal entry is missing');
      }
      edgeFocusNode('edge-tokyo-01');
      check(document.getElementById('modal-root')?.textContent.includes('Agent 终端'),'edge node terminal entry is missing');
      closeModal();
      state.view='cluster';
      state.activeNav='cluster';
      render();
      check(document.getElementById('main')?.textContent.includes('SSH 登录'),'cloud node terminal entry is missing');
    }
  }catch(error){
    failures.push(error?.stack||String(error));
  }
  terminalSmokeErrors.forEach(message=>failures.push('runtime error: '+message));
  const result=document.createElement('pre');
  result.id='terminal-smoke-result';
  result.textContent=failures.length?'FAIL\\n'+failures.join('\\n'):'PASS';
  document.body.appendChild(result);
},300));
</script>`;

test('browser exposes governed terminal sessions for pod, edge, and cloud targets', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'cloudforge-terminal-'));
  const tempHtml = path.join(tempDir, 'terminal.html');
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
      result.stdout.includes('id="terminal-smoke-result">PASS</pre>'),
      `terminal browser smoke test failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
