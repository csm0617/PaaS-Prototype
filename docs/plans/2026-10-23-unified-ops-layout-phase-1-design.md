# Unified Ops Layout Phase 1 Design

## Objective

Establish a shared page layout for the four core resource pages:

- Applications
- Components
- Workloads
- Architecture relationships

The goal is to stop page-specific spacing, table behavior, and header patterns
from drifting independently while preserving all current actions and data.

## Shared Page Contract

Core pages use:

- `page ops-page`
- `data-page-kind`
- a standard `page-head`
- optional shared statistics row
- a consistent content section
- responsive table or custom resource layout

Layout tokens:

- maximum content width: `1480px`
- horizontal page padding: `28px`
- bottom padding: `40px`
- page minimum height: viewport minus the top bar
- section gap: `16px`
- card radius: `8px`

## Core Page Adaptations

Applications, components, and workloads:

- retain their KPI rows and filters
- use the same card padding and section spacing
- table headers use a shared sticky/tinted treatment
- table actions remain visible
- narrow screens scroll tables inside their container rather than overflowing the
  page

Architecture:

- uses the same page width, header, spacing, and surface tokens
- retains its application and binding relationship layout
- cards align to the shared radius and border treatment

## Responsive Behavior

- Above 900px: standard sidebar and desktop content width.
- At or below 900px: page padding reduces consistently, KPI rows use two
  columns, filters wrap, and table containers own horizontal scrolling.
- The page itself must never overflow horizontally.

## Compatibility

No data model, filtering, editing, deletion, navigation, or publish behavior
changes. Existing page-specific CSS remains available to non-core pages until
later rollout phases.

## Testing

Chrome tests verify:

- all four core pages expose the shared page contract
- maximum width and bottom padding are consistent
- page headers and shared statistics use consistent layout
- table pages provide a contained scroll region
- architecture retains its resource layout
- narrow pages do not overflow
- no runtime errors
