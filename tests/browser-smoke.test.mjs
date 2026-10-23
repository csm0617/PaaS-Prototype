import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const sourcePath = path.join(
  workspace,
  'CloudForge_PaaS_云边协同发布闭环增强版.html',
);
const chromePath =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const smokeScript = `
<script>
const smokeErrors=[];
window.addEventListener('error',event=>smokeErrors.push(event.message||'window error'));
window.addEventListener('unhandledrejection',event=>smokeErrors.push(String(event.reason||'unhandled rejection')));
window.addEventListener('load',()=>setTimeout(async()=>{
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  try{
    const domain=window.CloudForgeReleaseDomain;
    check(!!domain,'release domain core is not available');

    const mock={id:'smoke-release',version:'v9.9.9',status:'deploying',events:[],audit:[],trafficBefore:{primaryWeight:90,candidateWeight:10,stableVersion:'v9.9.8'}};
    const moved=window.transitionReleaseStatus(mock,'rolling_back',{reason:'smoke rollback'});
    check(moved===true,'deploying -> rolling_back was rejected');
    check(mock.status==='rolling_back','rollback state was not applied');
    check(Array.isArray(mock.audit)&&mock.audit.length===1,'structured audit event was not appended');
    check(mock.audit?.[0]?.from==='deploying'&&mock.audit?.[0]?.to==='rolling_back','audit transition fields are incomplete');
    check(window.releaseStatusMeta('rolling_back')[0]==='回滚中','rolling_back status label is missing');
    const pauseApp=getApp('trade')||APPS[0];
    ensureReleaseData(pauseApp);
    const pauseRelease={id:'smoke-pause-release',version:'v9.9.8',status:'deploying',strategy:'灰度发布',events:[],audit:[],releaseTargets:[],trafficBefore:{primaryWeight:90,candidateWeight:10,stableVersion:pauseApp.version},trafficHistory:[],deploymentOrder:[],targetWorkloadIds:[]};
    pauseApp.releases.unshift(pauseRelease);
    if(typeof window.pauseReleaseTask==='function'){
      window.pauseReleaseTask(pauseApp.id,pauseRelease.id);
      check(pauseRelease.status==='paused','manual pause did not transition to paused');
      check(pauseApp.deployStatus==='paused','manual pause did not update application deploy status');
      check(pauseRelease.audit.some(event=>event.action==='pause'),'manual pause was not audited');
    }else{
      failures.push('manual pause entry is missing');
    }
    pauseApp.releases=pauseApp.releases.filter(item=>item.id!==pauseRelease.id);
    pauseApp.deployStatus='success';

    const node=window.EDGE_NODES.find(item=>item.id==='edge-nagoya-01');
    const deployment=window.TARGET_DEPLOYMENTS.find(item=>item.targetId==='edge-nagoya-01');
    node.status='offline';
    deployment.observedVersion='v1.1.9';
    deployment.desiredVersion='v1.2.0';
    deployment.syncSequence=7;
    window.edgeToggleNode(node.id);
    check(deployment.observedVersion===deployment.desiredVersion,'reconnect did not reconcile observed version');
    check(deployment.syncSequence===8,'reconnect did not advance the sync sequence');
    check(deployment.reconcileStatus==='consistent','reconnect did not mark deployment consistent');

    const app=getApp('trade')||APPS[0];
    ensureReleaseData(app);
    const row=getReleaseWorkloadRows(app)[0];
    const workload=row?.workload;
    check(!!row&&!!workload,'no workload is available for release execution smoke test');
    if(row&&workload){
      const version='v9.9.9',releaseId='smoke-exec-release';
      const startedAt=new Date().toLocaleString();
      const release={
        id:releaseId,version,status:'deploying',strategy:'滚动发布',notes:'browser smoke',time:startedAt,
        operator:app.owner||'smoke',current:false,targetWorkloadIds:[row.id],deploymentOrder:[row.id],
        releaseTargets:[{id:'smoke-target',releaseId,workloadId:row.id,componentId:row.component?.id||null,role:'primary',workloadName:row.name,imageBefore:workload.image,imageTarget:workload.image.replace(/:[^/:]+$/,'')+':'+version,desiredVersion:version,observedVersion:workload.observedVersion||'',status:'pending'}],
        healthGate:true,simulateFailure:false,snapshot:captureReleaseSnapshot(app,version,[row.id]),versionBefore:app.version,
        trafficBefore:getReleaseTrafficBaseline(app),trafficHistory:[],attempts:0,executionToken:1,progress:0,
        completedWorkloadIds:[],taskStates:{[row.id]:'pending'},events:[],audit:[]
      };
      workload.desiredVersion=version;
      workload.observedVersion=workload.observedVersion||imageVersionTag(workload.image);
      workload.reconcileStatus='drift';
      app.releases.unshift(release);
      app.deployStatus='deploying';
      await window.executeReleasePlan(app.id,releaseId,[row.id],1);
      check(release.status==='success','release execution did not finish in success after validation');
      check(app.version===version,'release success did not commit the application version');
      check(release.versionConsistency?.complete===true,'release reconciliation report is missing or incomplete');
      check(release.audit.some(event=>event.to==='validating'),'validating transition was not audited');
      check(release.audit.some(event=>event.to==='success'),'successful reconciliation was not audited');
    }
    state.appId=app.id;
    state.view='app';
    const release=app.releases.find(item=>item.id==='smoke-exec-release')||ensureReleaseData(app)[0];
    openReleaseTaskDetails(release.id);
    check(document.getElementById('modal-root')?.textContent.includes('结构化审计'),'release details do not show structured audit');
    check(document.getElementById('modal-root')?.textContent.includes('发布结果校验'),'release details do not show reconciliation report');
    check(document.getElementById('main')?.textContent.trim().length>0,'application view is blank');
    closeModal();
    state.view='cloud-edge';
    state.activeNav='cloud-edge';
    render();
    check(!!document.querySelector('.edge-closure-strip'),'cloud-edge closure summary is missing');
    check(document.querySelector('.edge-closure-strip')?.textContent.includes('版本对账'),'cloud-edge closure summary has no reconciliation metric');
  }catch(error){
    failures.push(error?.stack||String(error));
  }
  smokeErrors.forEach(message=>failures.push('runtime error: '+message));
  const result=document.createElement('pre');
  result.id='smoke-result';
  result.textContent=failures.length?'FAIL\\n'+failures.join('\\n'):'PASS';
  document.body.appendChild(result);
},300));
</script>`;

test('browser integrates guarded rollback, reconnect reconciliation, and audit UI', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'cloudforge-smoke-'));
  const tempHtml = path.join(tempDir, 'app.html');
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
      result.stdout.includes('id="smoke-result">PASS</pre>'),
      `browser smoke test failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
