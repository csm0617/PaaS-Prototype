# Terminal Access Gateway Design

## Objective

Add a unified terminal login experience to the CloudForge prototype for three
target types:

1. Workload Pod container terminals.
2. Cloud-edge node terminals through the Edge Agent.
3. Cloud host or Kubernetes node SSH terminals.

The current single-file HTML implementation uses a simulated gateway. The UI
and domain contracts must be compatible with a future WebSocket terminal
gateway backed by Kubernetes exec, an Edge Agent relay, or SSH.

## Architecture

Add a framework-free `terminal-domain-core` script to the HTML document. It
exports `CloudForgeTerminalDomain` for both browser behavior and Node tests.

The browser uses a `TerminalGateway` abstraction:

- `open(session, callbacks)` establishes a session.
- `send(sessionId, input)` sends command input.
- `resize(sessionId, cols, rows)` updates terminal dimensions.
- `close(sessionId, reason)` ends a session.
- Callbacks emit `output`, `state`, and `audit` events.

Two gateway implementations are recognized:

- `SimulatedTerminalGateway`: local command interpreter used by the prototype.
- `WebSocketTerminalGateway`: adapter contract for a future backend. It is
  configured but not connected in the single-file prototype.

## Targets

Each terminal target records:

- `type`: `pod`, `edge-node`, or `cloud-node`
- `id`
- display name
- application, component, workload, namespace, Pod, and container when relevant
- node IP or Agent endpoint
- online status

A Pod target must reference an existing workload and Pod. An edge target must
reference an online edge node. A cloud-node target must reference a cluster node
with `Ready` status.

## Session Model

Session states:

- `requested`
- `awaiting_approval`
- `active`
- `ended`
- `terminated`
- `expired`
- `denied`

Session fields:

- `id`
- `target`
- `actor`
- `role`
- `reason`
- `status`
- `requestedAt`
- `approvedAt`
- `startedAt`
- `expiresAt`
- `endedAt`
- `approvedBy`
- `ttlSeconds`
- `idleTimeoutSeconds`
- `commands`
- `audit`
- `recording`

Allowed transitions:

- `requested -> active`
- `requested -> awaiting_approval`
- `requested -> denied`
- `awaiting_approval -> active`
- `awaiting_approval -> denied`
- `active -> ended`
- `active -> terminated`
- `active -> expired`

Terminal states cannot be reactivated.

## Access Policy

Supported roles:

- `viewer`: no terminal access.
- `operator`: Pod and edge access; cloud-node access requires approval.
- `admin`: direct Pod and cloud-node access; edge access records a stronger
  audit event.

Additional policy:

- Block offline edge nodes and non-Ready cloud nodes.
- Require a non-empty access reason.
- Require an operator role for Pod terminal access.
- Require approval for operator access to cloud nodes.
- Limit the default session to 15 minutes and idle timeout to 5 minutes.

## Command Safety

The simulated terminal supports safe operational commands:

- Common: `help`, `whoami`, `pwd`, `ls`, `date`, `clear`, `exit`
- Pod: `cat /app/version`, `ps`
- Edge: `edge-agent status`, `sync status`
- Cloud node: `hostname`, `uptime`, `free -h`, `df -h`

Dangerous commands are always blocked in the prototype, regardless of role:

- Filesystem destruction such as `rm -rf /` or `mkfs`
- Host shutdown or reboot
- Kubernetes node deletion or drain commands
- Fork bombs and unsafe block-device writes

Every command records:

- command text
- risk level
- result
- exit code
- timestamp

Secret-looking environment values are masked in output.

## User Experience

Terminal entry points:

- Workload detail: open a Pod terminal.
- Pod detail: open the selected Pod container terminal.
- Edge node workbench: open the Edge Agent terminal.
- Cluster node row: open the SSH terminal.
- Terminal sessions page: active and historical sessions, commands, duration,
  and force termination.

The login dialog collects actor, role, reason, target context, and session TTL.
The terminal window displays connection state, approval state, command output,
safety warnings, and an end-session action.

## Persistence and Audit

Sessions and recordings persist in local storage with a versioned key.
Terminal audit events include:

- target context
- actor and role
- reason
- session state transitions
- command and risk classification
- exit code
- start, approval, and end timestamps

All seeded data is clearly marked as simulated.

## Error Handling

- Reject access before the gateway opens if the target is unavailable.
- Reject commands after expiration or termination.
- Do not create duplicate active sessions for the same actor and target.
- Keep blocked-command attempts in the audit trail.
- Close stale sessions on page load.
- Preserve a failed or ended session for inspection.

## Testing

Node tests extract and execute `terminal-domain-core` from the HTML. Tests cover:

- access policy for all roles and target types
- unavailable targets
- approval-required sessions
- session transition guards
- dangerous command detection
- simulated command output and exit codes
- audit event completeness
- expiration behavior

Chrome headless tests verify:

- opening a terminal from a workload
- login and command execution
- blocked-command feedback
- session close and persistence
- terminal sessions page rendering
- no JavaScript runtime errors

Visual checks cover desktop and narrow layouts.
