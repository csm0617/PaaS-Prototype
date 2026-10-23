# Cloud-Edge Release Closure Design

## Objective

Extend the existing single-file CloudForge prototype without replacing its current
views or local persistence. The release control plane must make the following
behaviors explicit and testable:

1. Release, pause, resume, cancel, retry, and rollback transitions.
2. Desired, observed, and reconciled versions for applications, workloads, and
   cloud-edge target deployments.
3. Stable traffic restoration when a blue-green or canary release is interrupted.
4. Edge autonomy while offline and automatic reconciliation after reconnection.
5. Structured audit records for state changes, health checks, traffic baselines,
   and rollback reasons.

## Architecture

Add one framework-free domain core inside the HTML document, identified as
`release-domain-core`. It exposes pure functions through
`globalThis.CloudForgeReleaseDomain` and is shared by browser behavior and Node
tests.

The existing UI functions remain the entry points. They call the domain core
rather than duplicating transition, reconciliation, traffic, and audit rules.
No new page or alternate prototype is introduced.

## Release State Model

Canonical states:

- `draft`
- `queued`
- `pending`
- `deploying`
- `validating`
- `paused`
- `rolling_back`
- `rolled_back`
- `partially_rolled_back`
- `success`
- `failed`
- `cancelled`

Rules:

- Execution reaches `validating` before `success`.
- Only a successful validation may commit the application version.
- A paused, failed, or cancelled task may enter `rolling_back`.
- `rolling_back` ends in `rolled_back`, `partially_rolled_back`, or `failed`.
- Terminal states cannot be silently changed. Retrying creates a new execution
  attempt from an allowed retry state.
- Invalid transitions return a denied result and append a structured audit event.

## Version Reconciliation

Each workload and target deployment records:

- `desiredVersion`
- `observedVersion`
- `reconcileStatus`
- `reconciledAt`

`reconcileStatus` is one of:

- `consistent`: desired and observed versions match and ready replicas meet the
  desired replica count.
- `missing`: no observed version has been reported.
- `drift`: the observed version differs from the desired version.
- `degraded`: versions match, but the target is offline or not fully ready.

An application-level summary contains the expected version, observed versions,
counts by reconciliation status, and the last reconciliation time. A release
tasks result is not applied to the application until its target reconciliation
passes.

## Traffic Safety

Capture the stable and candidate weights, route subsets, and source before
execution. Every pause, failure, cancellation, or validation failure restores
that exact baseline. A successful blue-green or canary release commits the
candidate as stable only after reconciliation passes.

Traffic restoration is a pure route transformation followed by an audit event.
The UI continues to show the historical traffic phases.

## Edge Autonomy

While an edge node is offline:

- Preserve cloud-side desired state.
- Preserve the last observed state reported by the node.
- Mark affected deployment reconciliation as `degraded` without overwriting the
  observed version.

When a node reconnects:

- Discover all target deployments assigned to the node.
- Compare desired and observed versions.
- Apply desired state in sequence.
- Increment `syncSequence`, update `lastReportedAt`, and record reconciliation
  results.
- Restore release progression only when all required targets are consistent.

## Audit Model

Every significant operation appends an event with:

- `id`
- `time`
- `releaseId`
- `action`
- `from`
- `to`
- `actor`
- `reason`
- `health`
- `result`
- `trafficBefore`
- `trafficAfter`
- `baselineVersion`

Existing human-readable release events remain for compatibility. The release
detail panel gains a structured audit section and a version reconciliation
table.

## Error Handling

- Invalid actions are rejected before mutating runtime objects.
- Execution tokens prevent stale timers from applying changes.
- Reconciliation does not promote a release while any target is `missing`,
  `drift`, or `degraded`.
- Offline nodes never report synthetic success; they retain the last observed
  state until reconnection.
- Rollback failures retain `failed` status and include the failure reason in the
  audit trail.

## Testing

Node's built-in test runner extracts and executes the `release-domain-core`
script from the HTML document. Tests cover:

- Allowed and denied release transitions.
- Validation-before-success promotion.
- Reconciliation outcomes for missing, drift, degraded, and consistent states.
- Stable traffic baseline restoration.
- Offline desired-state preservation and reconnect reconciliation.
- Structured audit event shape.

After unit tests pass, Chrome headless verifies that the full HTML loads without
JavaScript errors, the application renders, the release detail modal opens, and
the cloud-edge view remains interactive.
