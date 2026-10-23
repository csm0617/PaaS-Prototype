import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const htmlPath = new URL(
  '../CloudForge_PaaS_云边协同发布闭环增强版.html',
  import.meta.url,
);
const html = readFileSync(htmlPath, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function loadDomain() {
  const match = html.match(
    /<script id="terminal-domain-core">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, 'terminal-domain-core script is missing');

  const context = vm.createContext({ console });
  vm.runInContext(match[1], context, {
    filename: 'terminal-domain-core.js',
  });
  assert.ok(
    context.CloudForgeTerminalDomain,
    'CloudForgeTerminalDomain was not exported',
  );
  return context.CloudForgeTerminalDomain;
}

test('terminal access policy covers pod, edge, cloud-node, and viewer roles', () => {
  const domain = loadDomain();
  const onlineEdge = { type: 'edge-node', id: 'edge-1', available: true };
  const offlineEdge = { type: 'edge-node', id: 'edge-2', available: false };
  const cloudNode = { type: 'cloud-node', id: 'worker-01', available: true };

  assert.deepEqual(
    plain(
      domain.evaluateTerminalAccess({
        role: 'viewer',
        reason: 'inspect',
        target: { type: 'pod', id: 'pod-1', available: true },
      }),
    ),
    {
      allowed: false,
      initialStatus: 'denied',
      approvalRequired: false,
      reason: 'viewer role cannot open terminal sessions',
      ttlSeconds: 900,
      idleTimeoutSeconds: 300,
    },
  );
  assert.equal(
    domain.evaluateTerminalAccess({
      role: 'operator',
      reason: 'troubleshoot',
      target: { type: 'pod', id: 'pod-1', available: true },
    }).initialStatus,
    'active',
  );
  assert.equal(
    domain.evaluateTerminalAccess({
      role: 'operator',
      reason: 'restart service',
      target: cloudNode,
    }).initialStatus,
    'awaiting_approval',
  );
  assert.equal(
    domain.evaluateTerminalAccess({
      role: 'admin',
      reason: 'edge diagnosis',
      target: onlineEdge,
    }).initialStatus,
    'active',
  );
  assert.equal(
    domain.evaluateTerminalAccess({
      role: 'admin',
      reason: 'edge diagnosis',
      target: offlineEdge,
    }).allowed,
    false,
  );
});

test('terminal session creation records policy, TTL, target, and audit context', () => {
  const domain = loadDomain();
  const access = domain.evaluateTerminalAccess({
    role: 'operator',
    reason: 'collect diagnostics',
    target: { type: 'pod', id: 'pod-1', available: true },
  });
  const session = domain.createTerminalSession({
    id: 'term-1',
    actor: '张明',
    role: 'operator',
    reason: 'collect diagnostics',
    target: {
      type: 'pod',
      id: 'pod-1',
      name: 'web-frontend-abc',
      workloadId: 'wl-web',
      appId: 'trade',
    },
    access,
    now: '2026-10-23T10:00:00.000Z',
  });

  assert.equal(session.id, 'term-1');
  assert.equal(session.status, 'active');
  assert.equal(session.actor, '张明');
  assert.equal(session.target.type, 'pod');
  assert.equal(session.expiresAt, '2026-10-23T10:15:00.000Z');
  assert.ok(Array.isArray(session.commands));
  assert.ok(Array.isArray(session.audit));
  assert.equal(session.audit[0].action, 'session-opened');
  assert.equal(session.audit[0].target.id, 'pod-1');
});

test('terminal session transitions reject reopening terminal states', () => {
  const domain = loadDomain();

  assert.equal(domain.canTerminalTransition('requested', 'active'), true);
  assert.equal(
    domain.canTerminalTransition('awaiting_approval', 'active'),
    true,
  );
  assert.equal(domain.canTerminalTransition('active', 'ended'), true);
  assert.equal(domain.canTerminalTransition('ended', 'active'), false);

  const result = domain.transitionTerminalSession(
    { id: 'term-2', status: 'active', audit: [] },
    'ended',
    {
      now: '2026-10-23T10:05:00.000Z',
      actor: '张明',
      reason: 'finished',
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.session.status, 'ended');
  assert.equal(result.audit.from, 'active');
  assert.equal(result.audit.to, 'ended');
});

test('dangerous terminal commands are always blocked', () => {
  const domain = loadDomain();

  for (const command of [
    'rm -rf /',
    'mkfs.ext4 /dev/sda',
    'shutdown -h now',
    'kubectl drain worker-01 --ignore-daemonsets',
    ':(){ :|:& };:',
  ]) {
    const result = domain.classifyTerminalCommand(command);
    assert.equal(result.risk, 'blocked', command);
    assert.equal(result.allowed, false, command);
  }
});

test('simulated commands return target-aware output and append audit data', () => {
  const domain = loadDomain();
  const session = {
    id: 'term-3',
    status: 'active',
    expiresAt: '2099-01-01T00:00:00.000Z',
    actor: '张明',
    role: 'operator',
    target: {
      type: 'pod',
      id: 'pod-1',
      name: 'web-frontend-abc',
      workloadId: 'wl-web',
      version: 'v2.4.1',
    },
    commands: [],
    audit: [],
  };

  const versionResult = domain.runSimulatedCommand({
    session,
    command: 'cat /app/version',
    now: '2026-10-23T10:01:00.000Z',
  });
  assert.equal(versionResult.blocked, false);
  assert.match(versionResult.output, /v2\.4\.1/);
  assert.equal(versionResult.audit.command, 'cat /app/version');

  const blockedResult = domain.runSimulatedCommand({
    session,
    command: 'kubectl delete node worker-01',
    now: '2026-10-23T10:02:00.000Z',
  });
  assert.equal(blockedResult.blocked, true);
  assert.notEqual(blockedResult.exitCode, 0);
  assert.equal(blockedResult.audit.result, 'blocked');
});

test('expired sessions reject commands and sensitive output is masked', () => {
  const domain = loadDomain();
  const session = {
    id: 'term-4',
    status: 'active',
    expiresAt: '2026-10-23T10:00:00.000Z',
    actor: '张明',
    role: 'operator',
    target: { type: 'pod', id: 'pod-1', name: 'api-abc' },
    commands: [],
    audit: [],
  };

  assert.equal(
    domain.isTerminalSessionExpired(
      session,
      '2026-10-23T10:00:01.000Z',
      '2026-10-23T09:59:00.000Z',
    ),
    true,
  );
  const expiredResult = domain.runSimulatedCommand({
    session,
    command: 'whoami',
    now: '2026-10-23T10:00:01.000Z',
  });
  assert.equal(expiredResult.blocked, true);
  assert.equal(expiredResult.audit.result, 'expired');

  assert.equal(
    domain.maskSensitiveOutput('DB_PASSWORD=super-secret\nLOG_LEVEL=info'),
    'DB_PASSWORD=[REDACTED]\nLOG_LEVEL=info',
  );
});
