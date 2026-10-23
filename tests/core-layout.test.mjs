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

function runLayoutSmoke({ width, scriptName }) {
  const smokeScript = `
<script>
const coreLayoutErrors=[];
window.addEventListener('error',event=>coreLayoutErrors.push(event.message||'window error'));
window.addEventListener('unhandledrejection',event=>coreLayoutErrors.push(String(event.reason||'unhandled rejection')));
window.addEventListener('load',()=>setTimeout(()=>{
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  const pages=['apps','components','workloads','architecture'];
  try{
    for(const view of pages){
      state.view=view;
      state.activeNav=view;
      render();
      const page=document.querySelector('.page.ops-page');
      check(!!page,view+' shared page contract is missing');
      if(!page)continue;
      check(page?.dataset.pageKind===view,view+' page kind is missing');
      check(!!page?.querySelector('.page-head'),view+' page header is missing');
      check(getComputedStyle(page).maxWidth==='1480px',view+' page maximum width is inconsistent');
      check(getComputedStyle(page).paddingBottom==='40px',view+' page bottom padding is inconsistent');
      const compact=window.innerWidth<=900;
      if(view!=='architecture'){
        const stats=page.querySelector('.resource-stats');
        const cols=getComputedStyle(stats).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean);
        check(cols.length===(compact?2:4),view+' statistics layout does not match the shared responsive contract');
        if(view==='components')check(page.querySelectorAll('.page-head>.page-actions>.btn').length===2,'component header actions are not grouped');
        const scroll=page.querySelector('.table-scroll');
        check(!!scroll,view+' table scroll container is missing');
        if(scroll){
          const table=scroll.querySelector('table');
          check(!!table,view+' table is missing');
          if(compact&&table)check(parseFloat(getComputedStyle(table).minWidth)>=800,view+' narrow table is not protected from clipping');
          const rowActions=page.querySelector('.row-actions');
          if(rowActions)check(getComputedStyle(rowActions).flexWrap==='wrap',view+' row actions are not allowed to wrap');
        }
      }else{
        check(!!page.querySelector('.arch-components'),'architecture relationship layout is missing');
        if(!compact){
          const wrap=page.querySelector('.table-wrap'),table=wrap?.querySelector('table');
          check(!!wrap&&!!table,'architecture binding table is missing');
          if(wrap&&table)check(Math.abs(table.getBoundingClientRect().width-wrap.clientWidth)<2,'architecture binding table does not fill its container');
        }
      }
    }
    check(document.documentElement.scrollWidth<=window.innerWidth+2,'core page layout causes horizontal page overflow');
  }catch(error){
    failures.push(error?.stack||String(error));
  }
  coreLayoutErrors.forEach(message=>failures.push('runtime error: '+message));
  const result=document.createElement('pre');
  result.id='${scriptName}';
  result.textContent=failures.length?'FAIL\\n'+failures.join('\\n'):'PASS';
  document.body.appendChild(result);
},300));
</script>`;

  const tempDir = mkdtempSync(path.join(tmpdir(), 'cloudforge-core-layout-'));
  const tempHtml = path.join(tempDir, 'core-layout.html');
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
        `--window-size=${width},1100`,
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
    return {
      ok: result.stdout.includes(`id="${scriptName}">PASS</pre>`),
      output: `STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('core resource pages use a shared desktop layout contract', () => {
  const result = runLayoutSmoke({ width: 1320, scriptName: 'core-layout-desktop' });
  assert.ok(result.ok, `desktop core layout failed\n${result.output}`);
});

test('core resource pages preserve the layout contract at narrow width', () => {
  const result = runLayoutSmoke({ width: 900, scriptName: 'core-layout-narrow' });
  assert.ok(result.ok, `narrow core layout failed\n${result.output}`);
});
