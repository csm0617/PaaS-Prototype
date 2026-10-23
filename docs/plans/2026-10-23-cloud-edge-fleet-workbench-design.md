# Cloud-Edge Fleet Workbench Design

## Objective

Replace the oversized cloud-edge overview with a compact fleet workbench while
preserving all existing node, target deployment, cooperative release, device,
and synchronization actions.

The redesign must:

- Remove duplicated hero, summary, and KPI layers.
- Keep node selection, deployment state, and synchronization context together.
- Expose terminal, reconcile, and node-detail actions from the selected node.
- Reduce tab pressure at narrow widths.
- Preserve existing legacy tabs and their mutation handlers.

## Layout

The page uses:

1. A compact page header with a create-release action and node selector on narrow
   screens.
2. A four-metric status strip for online nodes, target deployments, version
   consistency, and pending releases.
3. A compact wrapping tab row.
4. A three-column overview workbench on desktop:
   - target scope and edge-node list
   - selected node deployment area
   - node inspector with sync data, devices, release activity, terminal, and
     reconcile actions

Below 1000px, the scope and inspector columns collapse, the selected node is
chosen from a native select, and deployment rows stack vertically.

## Selection and State

Reuse `edgeSelectedNodeId`.

- The first online edge node is selected by default.
- Selecting a node updates the detail panel without opening a modal.
- A node selector remains available at narrow widths.
- Existing node-detail modal remains available for deeper actions.

## Legacy Tabs

The following existing tabs remain functional:

- nodes
- targets
- deployments
- rollout
- devices
- sync

The workbench affects the `overview` tab. Other tabs retain their existing data
and handlers but use the compact header and wrapping tab navigation.

## Error Handling

- If no edge nodes exist, show a focused empty state with a node-registration
  action.
- Offline nodes remain selectable and show degraded/autonomous state.
- Existing authorization, release, and mutation guards are unchanged.

## Testing

Chrome tests verify:

- the compact fleet workbench renders
- the old hero is hidden
- an online node is selected by default
- selecting another node updates the detail and inspector
- the node selector exists at narrow width
- tabs wrap rather than causing horizontal page overflow
- legacy tabs remain reachable
- no runtime errors

Visual checks cover desktop and 900px widths.
