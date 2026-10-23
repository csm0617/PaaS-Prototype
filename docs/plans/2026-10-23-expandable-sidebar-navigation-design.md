# Expandable Sidebar Navigation Design

## Objective

Add a two-level expandable sidebar for modules that contain multiple operational
views, starting with:

- Cloud-edge collaboration
- Gateway and routing

Other navigation items remain flat.

## Navigation Model

Desktop sidebar:

- A parent row navigates to the module default view.
- A separate chevron button toggles the child menu without changing the page.
- Only one expandable group is open at a time.
- The active module remains expanded after navigation.

Cloud-edge children:

- 运行总览
- 边缘节点
- 目标组
- 部署实例
- 协同发布
- 端侧设备
- 同步策略

Gateway children:

- 路由详情
- 灰度流量
- 配置检查

## State

Add `state.expandedNav`.

Sidebar helpers:

- `sidebarGroupExpanded(id)`
- `toggleSidebarGroup(id)`
- `goSidebarChild(parentId, childId)`
- `sidebarChildActive(parentId, childId)`

Child navigation updates the existing page state rather than introducing new
routes:

- Cloud-edge child updates `edgeActiveTab`.
- Gateway child updates `state.gatewayTab`.

## Duplicate Navigation

On desktop, hide the cloud-edge horizontal tab row and gateway detail tab row
because the sidebar is the primary navigation. On narrow screens, keep those
in-page tabs visible and hide sidebar child menus.

## Responsive Behavior

- Above 900px: full sidebar tree.
- At or below 900px: retain the current horizontal app navigation; child menus
  are hidden and page-level tabs provide module navigation.
- Sidebar receives vertical scrolling when expanded content exceeds viewport
  height.

## Accessibility

- Chevron toggle is a native button with `aria-expanded`.
- Parent row remains keyboard/screen-reader navigable.
- Child rows expose the current item with an active class.

## Testing

Chrome tests verify:

- expandable parents and seven cloud-edge children render
- chevrons toggle expansion
- only one group is expanded at a time
- child navigation updates `edgeActiveTab` and `state.gatewayTab`
- active child and parent states are correct
- duplicate desktop tabs are hidden
- existing page destinations remain reachable
- no JavaScript errors
