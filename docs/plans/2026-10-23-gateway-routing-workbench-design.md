# Gateway Routing Workbench Design

## Objective

Refactor the gateway and routing page into a master-detail workbench without
changing the underlying gateway, route, traffic policy, or release behavior.

The redesign must:

- Make route selection and route editing the primary task.
- Remove duplicate overview cards from the first viewport.
- Keep ingress, application gateway, traffic policy, and validation accessible.
- Prevent route action buttons from being clipped.
- Stack cleanly at narrow widths.

## Layout

The page uses four layers:

1. A compact page header with application selection and publish status.
2. A four-item context strip for cluster ingress, application gateway, route
   count, and applied resource version.
3. A master route list with route name, host/path, target service, and state.
4. A detail panel for the selected route.

Desktop uses a two-column master-detail layout. Below 1000px, the route list and
detail panel stack vertically. Route rows are native buttons rather than table
rows so the entire row is keyboard accessible.

## Detail Panel

The selected route has three local tabs:

- `路由详情`
- `灰度流量`
- `配置检查`

Route detail contains:

- Traffic path from cluster ingress through the optional application gateway to
  the selected target component.
- Host, path, method, protocol, target port, and enabled state.
- Forwarding mode and application entry address.
- Edit, enable/disable, and delete actions.

The traffic tab reuses the existing policy form and must keep current input IDs so
that `saveTrafficPolicy` remains compatible.

The checks tab reuses `gatewayValidation(app)`.

## State

UI state:

- `state.gatewayAppId`
- `state.gatewayRouteId`
- `state.gatewayTab`

When the application changes, the selected route resets. When a route is created
or edited, it becomes selected. When the selected route is deleted, the next
available route becomes selected.

No new persistent domain data is introduced.

## Error Handling

- If no routes exist, show a focused empty state with a create-route action.
- If a route references a missing target, keep it visible and show an error.
- Existing mutation guards and confirmation dialogs remain in place.
- Invalid form values continue to be rejected by existing save handlers.

## Testing

Chrome tests verify:

- the workbench renders with a master list and detail panel
- the first route is selected automatically
- route changes update `state.gatewayRouteId`
- tab switching shows traffic and validation content
- creating or editing a route selects it
- narrow layout uses one workbench column
- no JavaScript runtime errors

Visual checks cover desktop and 900px widths.
