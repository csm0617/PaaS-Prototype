import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const htmlPath = new URL(
  '../CloudForge_PaaS_云边协同发布闭环增强版.html',
  import.meta.url,
);
const html = readFileSync(htmlPath, 'utf8');

function loadDomain() {
  const match = html.match(
    /<script id="release-domain-core">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, 'release-domain-core script is missing');

  const context = vm.createContext({ console });
  vm.runInContext(match[1], context, {
    filename: 'release-domain-core.js',
  });
  assert.ok(
    context.CloudForgeReleaseDomain,
    'CloudForgeReleaseDomain was not exported',
  );
  return context.CloudForgeReleaseDomain;
}

const plain = value => JSON.parse(JSON.stringify(value));

test('release lifecycle requires validation before success and supports rollback', () => {
  const domain = loadDomain();

  assert.equal(domain.canReleaseTransition('deploying', 'validating'), true);
  assert.equal(domain.canReleaseTransition('validating', 'success'), true);
  assert.equal(domain.canReleaseTransition('deploying', 'success'), false);
  assert.equal(domain.canReleaseTransition('paused', 'rolling_back'), true);
  assert.equal(
    domain.canReleaseTransition('rolling_back', 'partially_rolled_back'),
    true,
  );
  assert.equal(domain.canReleaseTransition('rolled_back', 'deploying'), false);
});

test('release actions map to guarded target states', () => {
  const domain = loadDomain();

  assert.equal(domain.releaseActionTarget('deploying', 'pause'), 'paused');
  assert.equal(domain.releaseActionTarget('paused', 'resume'), 'deploying');
  assert.equal(domain.releaseActionTarget('validating', 'cancel'), 'cancelled');
  assert.equal(
    domain.releaseActionTarget('failed', 'rollback'),
    'rolling_back',
  );
  assert.equal(domain.releaseActionTarget('success', 'cancel'), null);
});

test('version reconciliation distinguishes missing, drift, degraded, and consistent', () => {
  const domain = loadDomain();

  assert.equal(domain.reconcileVersionState({}).status, 'missing');
  assert.equal(
    domain.reconcileVersionState({
      desiredVersion: 'v2.0.0',
      observedVersion: 'v1.0.0',
      ready: 2,
      replicas: 2,
      nodeOnline: true,
    }).status,
    'drift',
  );
  assert.equal(
    domain.reconcileVersionState({
      desiredVersion: 'v2.0.0',
      observedVersion: 'v2.0.0',
      ready: 0,
      replicas: 2,
      nodeOnline: false,
    }).status,
    'degraded',
  );
  assert.equal(
    domain.reconcileVersionState({
      desiredVersion: '2.0.0',
      observedVersion: 'v2.0.0',
      ready: 2,
      replicas: 2,
      nodeOnline: true,
    }).status,
    'consistent',
  );
});

test('traffic restoration returns the captured stable and candidate baseline', () => {
  const domain = loadDomain();
  const baseline = {
    stableVersion: 'v1.0.0',
    canaryVersion: 'v1.1.0',
    primaryWeight: 90,
    candidateWeight: 10,
    source: 'trafficPolicy',
  };

  assert.deepEqual(
    plain(
      domain.restoreTrafficBaseline(baseline).map(({ name, weight }) => ({
        name,
        weight,
      })),
    ),
    [
      { name: 'v1.0.0', weight: 90 },
      { name: 'v1.1.0', weight: 10 },
    ],
  );
  assert.deepEqual(
    plain(
      domain
        .restoreTrafficBaseline({
          stableVersion: 'v1.0.0',
          primaryWeight: 100,
          candidateWeight: 0,
        })
        .map(({ name, weight }) => ({ name, weight })),
    ),
    [{ name: 'v1.0.0', weight: 100 }],
  );
});

test('offline edge nodes preserve desired and observed state until reconnect', () => {
  const domain = loadDomain();
  const offline = domain.reconcileEdgeDeployment({
    deployment: {
      desiredVersion: 'v2.0.0',
      observedVersion: 'v1.0.0',
      syncSequence: 4,
    },
    node: { id: 'edge-1', status: 'offline' },
  });

  assert.equal(offline.deployment.desiredVersion, 'v2.0.0');
  assert.equal(offline.deployment.observedVersion, 'v1.0.0');
  assert.equal(offline.deployment.syncSequence, 4);
  assert.equal(offline.deployment.reconcileStatus, 'degraded');

  const online = domain.reconcileEdgeDeployment({
    deployment: offline.deployment,
    node: { id: 'edge-1', status: 'online' },
    desiredState: { configVersion: 3 },
    now: '2026-10-23T10:00:00.000Z',
  });

  assert.equal(online.deployment.desiredVersion, 'v2.0.0');
  assert.equal(online.deployment.observedVersion, 'v2.0.0');
  assert.equal(online.deployment.configVersion, 3);
  assert.equal(online.deployment.syncSequence, 5);
  assert.equal(online.deployment.reconcileStatus, 'consistent');
  assert.equal(online.deployment.lastReportedAt, '2026-10-23T10:00:00.000Z');
});

test('structured audit events preserve operator, transition, health, and traffic context', () => {
  const domain = loadDomain();
  const event = domain.createAuditEvent({
    releaseId: 'rel-1',
    action: 'pause',
    from: 'deploying',
    to: 'paused',
    actor: 'operator@example.com',
    reason: 'readiness failed',
    health: { ready: 1, replicas: 2, result: 'failed' },
    result: 'blocked',
    trafficBefore: { primaryWeight: 90, candidateWeight: 10 },
    trafficAfter: { primaryWeight: 90, candidateWeight: 10 },
    baselineVersion: 'v1.0.0',
  });

  assert.match(event.id, /^audit-/);
  assert.ok(Number.isFinite(Date.parse(event.time)));
  assert.equal(event.releaseId, 'rel-1');
  assert.equal(event.from, 'deploying');
  assert.equal(event.to, 'paused');
  assert.equal(event.health.result, 'failed');
  assert.equal(event.trafficAfter.candidateWeight, 10);
  assert.equal(event.baselineVersion, 'v1.0.0');
});
