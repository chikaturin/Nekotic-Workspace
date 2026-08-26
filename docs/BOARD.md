# Board core — architecture report (FUNC 7–25)

Covers `BD-COR-07` → `BD-DRW-11` (board core), `VW-KAN-12` → `VW-SAV-18` (the
view layer) and `DV-TMP-19` → `DV-EMB-25` (templates, dev tools and relations).

---

## 1. Board architecture

### The rule

**A board owns one schema and one set of records. A view owns nothing but presentation.**

There is no `tableRows`, no `kanbanRows`, no `calendarRows`. There is `rowsById` +
`rowOrder`, and a pure query that every view calls.

```
Board ──┬── columns : BoardColumn[]        schema — shared by every view
        ├── views   : SavedView[]          presentation — one per view
        └── rowIdPrefix / primaryColumnId

Records ─── rowsById : Record<id, BoardRow>    normalised, one object per record
        └── rowOrder : string[]                canonical server order

queryRowIds(view, records, columns) ──▶ string[]
                       │
     ┌─────────────────┼──────────────────┬──────────────────┐
  flattenGroups     buildGroups        buildMonth         buildBars
   (Table)           (Kanban)          (Calendar)         (Timeline)
```

Each view is a *projection function* over the ids that query returns. None of
them holds records, and none of them can disagree with the table.

### Model

| Type | File | Notes |
| --- | --- | --- |
| `Board` | [types/board.ts](../src/types/board.ts) | schema + saved views + `rowIdPrefix` |
| `BoardColumn` | same | discriminated union on `type`; carries `id`, `name`, `type`, `position`, `width`, `hidden`, `config`, `isPrimary` |
| `BoardRow` | same | `id`, `displayId`, `sequence`, `cells`, `revision`, timestamps |
| `CellValue` | same | tagged union, one variant per column type |
| `SavedView` | same | `type`, `filters`, `sorts`, `hiddenColumnIds`, `columnOrder`, `columnWidths`, `rowHeight`, `groupByColumnId`, `dateColumnId`, `endDateColumnId` |

`BoardColumn` is a **union**, not a struct with a loose `config: any`:

```ts
export type BoardColumnOf<T extends ColumnType> = ColumnBase & {
  readonly type: T;
  readonly config: ColumnConfigByType[T];
};
export type BoardColumn = { [T in ColumnType]: BoardColumnOf<T> }[ColumnType];
```

Narrowing on `column.type` gives the renderer the exact config shape — a select
editor cannot be handed a date config, and adding an eighth cell type is a
compile error in every switch that has to handle it.

### Why cell values are tagged

`CellValue` carries its own `kind` instead of being interpreted through the
column. Two things fall out of that:

1. A cell whose kind no longer matches its column (a schema change that raced an
   edit) reads as empty rather than crashing the wrong editor — `cellOf()`.
2. **Column conversion never loses data.** A value the target type cannot parse
   is stored *as text on the new value*:

```ts
{ kind: "date", iso: null, text: "sometime next sprint" }
```

The cell renders that text with a warning marker instead of blanking it. This is
`BD-TBL-08`'s Text→Date edge case, implemented as a property of the model rather
than as a special case in the UI.

### Split: schema vs presentation

| Operation | Writes to | Visible to |
| --- | --- | --- |
| Rename column, change type, change config, add/delete column | **board.columns** | every view |
| Resize, hide/show, reorder, sort, filter, row height | **the active SavedView** | that view only |

Hiding a column in the table therefore cannot blank the Kanban card, and the
schema stays the single description of what the data *is*.

`resolveColumns(board, view)` merges the two and returns the render order.
`pruneView(view, columns)` drops filters/sorts/order entries that point at a
deleted column — `VW-SAV-18`'s edge case, handled the moment a column dies.

### Custom row ID (`BD-RID-10`)

The client **never** invents an id.

- `boardService.createRow` increments a per-board counter and returns
  `{ id, displayId, sequence, revision }`.
- The counter only ever increases, so deleting `TASK-005` does not release `005`
  ([test](../tests/board-service.test.ts)).
- While a create is in flight the optimistic row shows `TASK-…`, not a guessed
  number. The real id arrives with the response and replaces it in place.
- `lib/row-id.ts` formats, normalises prefixes, extracts `QA-128`-style
  references from comment text and matches `task 7` → `TASK-007` for search.

---

## 2. State flow

Two stores, deliberately separated.

```
board-store.ts   records + schema + views      (the data)
grid-store.ts    focus, selection, editing,    (the interaction)
                 drawer target
```

Keeping them apart is a rendering decision as much as a modelling one: moving the
cursor writes to `grid-store`, which no row subscribes to.

```
   node route
        │
   useBoard(nodeId) ──▶ boardService.getBoard() ──▶ board-store.load()
        │                                              rowsById + rowOrder
        ▼
   useBoardView()   ── memoised ──▶ { columns, columnsShown, rowIds, context }
        │                                │
        ├──────────────▶ TableGrid ──────┤
        └──────────────▶ RowDrawer ──────┘   same records, same editors
```

`useBoardView` is the only query. It runs `queryRowIds`, which applies filters →
search → sort in one pass and returns row ids. Kanban will group those same ids
by `view.groupByColumnId`; Calendar will bucket them by `view.dateColumnId`. No
new record store, no synchronisation step.

**Drawer ↔ table sync is not implemented, it is structural.** The drawer reads
`rowsById[drawerRowId]` and writes through `editCells` — the same object and the
same action the grid uses, so an edit in the drawer is on screen in the row
behind it on the next render.

---

## 3. Rendering strategy

The target is 5.000 records with no jank while a single cell is edited. Four
mechanisms, each doing one job.

### 3.1 Row virtualisation

`lib/grid-geometry.ts` is pure maths (`windowRange`), `use-virtual-rows.ts` binds
it to a scroll container measured with a `ResizeObserver`. Only
`viewport / rowHeight + 2 × overscan` rows are mounted — about 20–30 of 5.000.
Above and below the window sit two spacer divs, so the scrollbar is exact and
nothing is absolutely positioned.

### 3.2 Structural sharing

`applyCellEdits` returns a new `rowsById` in which **only the edited row is a new
object**; every other row keeps its identity. `GridRow` is `memo`'d and
subscribes to its own record:

```tsx
const row = useBoardStore(selectRow(rowId));
```

Editing row 12 therefore re-renders row 12 and nothing else. A test asserts the
identity guarantee directly, because it is easy to break by accident.

### 3.3 Boolean subscriptions for selection

`GridCell` does not receive the selection. It selects three booleans:

```tsx
const isFocused  = useGridStore(selectIsFocused(rowIndex, columnIndex));
const isSelected = useGridStore(selectIsSelected(rowIndex, columnIndex));
const isEditing  = useGridStore(selectIsEditing(row.id, column.id));
```

Moving the cursor changes two booleans, so two cells re-render — not 300.

### 3.4 Column width in CSS variables

Widths live as `--col-w-<id>` on the grid container; cells read
`width: var(--col-w-<id>)`. A resize drag calls
`container.style.setProperty(...)` on every pointer move — **zero React
renders** — and only the pointer-up commits to the store and the API.

### Cost summary

| Interaction | Components re-rendered |
| --- | --- |
| Move the cursor | 2 cells |
| Edit one cell | 1 row (its ~10 cells) |
| Drag a column edge | 0 (DOM write only) |
| Scroll | the grid container + the rows entering the window |
| Change filter/sort/search | the container; rows only if their record changed |

---

## 4. Mutation flow

Every write follows the same three beats: **optimistic → request → reconcile or
roll back**.

```
editCells(edits)
   │
   ├─ captureCells()      snapshot { previous, expected } per cell
   ├─ applyCellEdits()    optimistic — on screen before the request leaves
   │
   ├─ boardService.updateCells({ edits, baseRevisions })
   │        ├─ ok    → reconcileRows(server rows)   + surface conflicts[]
   │        └─ fail  → revertCellEdits(reverts)     + error toast
```

### Rollback that respects a newer write

Naive rollback clobbers whatever happened while the request was in flight.
`revertCellEdits` restores a cell **only if it still holds the value this
mutation wrote**:

```ts
if (!cellEquals(row.cells[revert.columnId], revert.expected)) continue;
```

A later edit on the same cell therefore survives a failed earlier one — the
last-write-wins policy `BD-COR-07` asks for, implemented where it belongs.

### Optimistic identity for creates

Row creation cannot be fully optimistic, because the id belongs to the server:

1. Insert a `tmp_…` row with `displayId: "TASK-…"` and `isPending: true`.
2. On success, `replaceRow(tempId, serverRow)` swaps the record and its id **in
   place**, keeping its position in `rowOrder`.
3. On failure, `removeRow(tempId)`.

### Conflict reporting

`updateCells` sends the `revision` each edit was based on. If the server has
moved on it applies the write anyway (last-write-wins) and returns a
`conflicts[]` entry, which the board renders as a dismissible banner.

### Mutation inventory

| Action | Optimistic | Rollback | Reconciliation |
| --- | --- | --- | --- |
| `editCells` | yes | guarded per cell | server rows + conflicts |
| `addRow` / `duplicateRow` | yes (`tmp_` row) | remove the placeholder | id + displayId swap |
| `deleteRow` | yes | re-insert at its index | — |
| `renameColumn` / config | yes | restore the column list | server column |
| `convertColumn` | no (server rewrites rows) | — | column + rewritten rows |
| `addColumn` / `deleteColumn` | no | — | server column list |
| Resize / hide / reorder / sort | yes (view patch) | restore the view field | server view |
| `createOption` | no | — | server option |

Column conversion is deliberately **not** optimistic: it rewrites every row, and
guessing the result client-side would double the work and risk drift.

---

## 5. API contracts still missing

Everything below is currently satisfied by the in-memory service in
[`services/board-service.ts`](../src/services/board-service.ts), which is shaped
like the HTTP API that replaces it. These are the decisions the backend still
owes us.

### Blocking

1. **Record pagination.** `getBoard` returns every row in one page
   (`nextCursor: null`). At 5.000 rows that is already a multi-megabyte payload
   and it does not scale. Needed: `GET /boards/:id/rows?cursor=&limit=` plus a
   total count, and a decision on whether the client keeps the full set in memory
   (current design) or windows it.
2. **Atomic row-id allocation.** `displayId` must come from a real database
   sequence, not `MAX(sequence) + 1`. Two simultaneous creates must never produce
   `TASK-005` twice, and a deleted number must never be reissued.
3. **Batch cell write.** One paste can produce hundreds of edits.
   `PATCH /boards/:id/cells` needs: a documented max batch size, transactional
   semantics (all-or-nothing vs per-edit results) and a per-row `baseRevision`.
   The client already sends revisions; the server has to act on them.
4. **Conflict policy, confirmed.** We implement last-write-wins plus a notice.
   The backend has to agree, and to return the authoritative row so the client
   can reconcile rather than guess.
5. **Realtime channel.** `BD-COR-07` asks for < 300 ms cross-client sync. That
   needs `row.created` / `row.updated` / `row.deleted` / `column.changed` /
   `view.changed` events over WebSocket or SSE. The store is ready for them —
   `reconcileRows` is the entry point — but there is no transport.

### Needed before the module is complete

6. **Column conversion at scale.** Today it returns every rewritten row in the
   response. For 5.000 rows that must become either a job with progress
   (`202 Accepted` + poll) or "converted, refetch the page", plus a documented
   `preserved` count so the UI can keep warning the user.
7. **Row ordering.** `rowOrder` is currently the array the server sent. Manual
   reordering and concurrent inserts need an explicit order key (fractional index
   / LexoRank) and `PATCH /rows/:id/position`.
8. **Select option creation must dedupe by label.** Two users typing "Blocked"
   at the same moment must end up with one option. Contract: `POST` returns the
   existing option when the label already exists (200, not 409).
9. **Attachment ↔ cell linking.** Cell attachments reuse the upload service, but
   nothing links an asset to a cell server-side. Needed: an attach/detach
   endpoint, thumbnail URLs with a documented expiry, and permission scoping so a
   cell cannot leak a file the viewer may not open.
10. **Relation semantics.** Wired as far as the client can go on its own. Still
    undecided: bidirectional mirroring (does B show "blocks A"?), what happens to
    a relation when its target row is deleted, cross-board permission checks, and
    a bulk resolver `GET /boards/:id/rows?ids=` so chips can show titles instead
    of ids.
11. **Saved views: personal vs shared.** Column widths currently live on the
    shared view, so one user's resize would reach everyone. We need per-user
    overrides (`PATCH /views/:id/preferences`) separated from the shared
    definition, and a rule for who may edit a shared view.
12. **Server-side query.** Filter, sort and search run in the browser over the
    full record set. That is fine at 5.000 rows and wrong at 100.000. A query DSL
    has to be agreed before the dataset grows — the client already funnels every
    view through one function, so the swap is contained.

### Adjacent modules that will need contracts

13. **Global search by display id** (`BD-RID-10`): the command palette searches
    drive nodes only. Cross-board record search needs its own endpoint.
14. **Comments**: pagination, editing, deletion, `@user` mentions and record
    mentions, unread state. The composer and its local-storage draft are done;
    the thread is a placeholder.
15. **Activity**: currently synthesised from the writes this session served. Real
    audit events need a stable schema and pagination.
16. **Field- and row-level permissions** for the RBAC module — the board reuses
    the drive node's capabilities today.
17. **Undo**: no inverse-operation log exists. If ⌘Z is wanted, the mutation
    envelope should carry one.

---

## The view layer (FUNC 12–18)

### One query, four readings

`useBoardView` runs `queryRowIds` once — filters, then search, then sort — and
every view consumes the ids it returns:

| View | Projection | Interaction writes |
| --- | --- | --- |
| Table | `flattenGroups` / `flattenUngrouped` → one uniform-height list | any cell |
| Kanban | `buildGroups` → a column per bucket | the group column's cell |
| Calendar | `buildMonth` → six Monday-first weeks + `unscheduled` | the date column's cell |
| Timeline | `timelineScale` + `buildBars` → offsets in whole days | the start and end date cells |

A drag in any view is one `editCells` call on the board record. That is why
"drag in Kanban" and "edit in the table" are the same mutation with different
gestures — and why the cross-view tests pass without any synchronisation code.

### Filter engine (`VW-FLT-15`)

Conditions live on the saved view as a flat list plus one conjunction
(`all of` / `any of`), which is the model Airtable and Notion use and the one
the PRD's example needs. Operators are offered **per cell type**
([`lib/board-filters.ts`](../src/lib/board-filters.ts)): `contains` is not
offered on a date, `before` is not offered on a select, and attachment columns
only offer presence checks.

Values are matched by identity first: a select or user condition accepts an
option id, a user id, *or* the label, so a filter written by the UI and one
written by hand agree. Date conditions compare calendar days, not instants.

### Sort (`VW-SRT-16`)

Multi-level. Level order is the tie-break order — `compareRows` walks it and
stops at the first difference. Empty values always sink, whichever direction is
chosen, which is the PRD's rule.

### Group (`VW-GRP-17`)

`buildGroups` produces buckets from the **schema**, not the records, so a status
with no records still gets a column in Kanban. `hideEmptyGroups` switches the
table to the other behaviour the PRD allows. Collapse state is UI state, kept
per view id in the grid store, and a collapsed group contributes its header and
nothing else — so collapsing is instant at any record count.

### Saved views (`VW-SAV-18`)

A view stores name, type, filters, conjunction, sorts, group column, hidden
columns, column order, column widths, row height and the date anchors. Creating,
duplicating, renaming and deleting a view are all configuration writes;
switching views cannot copy a record, and a test asserts `rowsById` keeps its
object identity across a switch.

`pruneView` drops every reference to a deleted column — filters, sorts, order,
hidden ids, the group column and both date anchors — so a view survives a schema
change instead of rendering against a column that is gone.

### Permission and rollback

A drag checks `capabilities.edit` **before** the optimistic write, so a card the
user may not move never leaves its column, and a toast says why. If the write
itself fails, `revertCellEdits` puts the card back — the same rollback the table
uses, exercised by a test on the Kanban path.

### Timeline specifics

One unit is always a day; zoom only changes pixels per day, which keeps every
offset in whole days and the maths exact. A start after its end is **swapped and
reported** (`orderRange`), per the PRD. A record with only one of the two dates
renders as a dashed single-day bar rather than disappearing.

---

## Developer tools and relations (FUNC 19–25)

### Templates are inert data (`DV-TMP-19`)

Four blueprints — Task, Bug, QA/QC and API documentation — live in
[`lib/board-templates.ts`](../src/lib/board-templates.ts) as frozen data.
`instantiateColumns` deep-copies everything it hands out, so a board can rename,
retype or delete a column without the template it came from ever changing. The
catalogue is `Object.freeze`d as well, so an accidental in-place write throws
instead of corrupting the next board. A test asserts both halves.

A template supplies schema only: columns, their option colours, the saved views
and the row-id prefix. Records are the board's own from the first row.

### API documentation (`DV-API-20`)

`API ID` is the board's row identifier (`API-001`), so it is the prefix rather
than a column — one source of truth for the reference code. The Method column
ships with a colour per verb, and
[`lib/api-catalog.ts`](../src/lib/api-catalog.ts) recomputes duplicate
`endpoint + method` pairs on every edit. Duplicates are **warned, never
blocked**: the banner lists each pair and the rows carry an amber rail, because
a catalogue may legitimately hold a draft of an endpoint that is being replaced.

### Environment (`DV-ENV-21`)

Three labels — Development, Staging, Production — defined **once** as
`ENVIRONMENT_OPTIONS` and referenced by the Bug, QA and API templates and by
config documents. No new dropdown was built: the board's own select chip and
select cell type render it everywhere. Pointing a config document at Production
needs manage rights and is confirmed first.

### Config documents (`DV-CFG-22`)

A document kind rather than a new node type, so routing, permissions and the
pin/lock/archive lifecycle come for free.

- [`lib/syntax.ts`](../src/lib/syntax.ts) is a small line-oriented tokeniser for
  JSON, `.env` and YAML — enough colour without a highlighting engine.
- [`lib/json-lint.ts`](../src/lib/json-lint.ts) uses `JSON.parse` as the parser
  and turns the engine's message into a line and column, which the editor
  underlines in place.
- The editor is a transparent textarea over a coloured `<pre>`, both sharing
  font metrics and scroll position, so the caret never drifts.
- Every save is a version. **Restoring appends a new version** rather than
  rewinding, so the history of what happened stays complete.

### Secret documents (`DV-SEC-23`)

The contract is enforced by shape, not by discipline:

- `SecretEntry` has no `value` field. `getSecrets` cannot return plaintext
  because the type it returns has nowhere to put it.
- Plaintext leaves the service through one call that checks the role, records an
  audit entry — including denied attempts — and returns the value once.
- The client keeps revealed values in component state only, drops them after 30
  seconds and forgets them on unmount. Nothing reaches local storage, session
  storage or any cache, and the codebase contains **zero** `console` calls.
- Copy re-fetches through the same gate rather than reusing a revealed value.
- Nothing is decrypted client-side; the service is the only source of a value.

### Relation and backlink (`DV-REL-24`)

A relation column names its target board, so a whole column resolves in **one**
request instead of one per cell (`relationIndex`). A row id missing from a
*resolved* index renders as `[Deleted Item]`; before resolution it is merely
unknown, never shown as deleted.

Backlinks are derived, not stored: `listBacklinks` asks which rows point here,
so the two directions cannot disagree. The drawer renders them with the source
board, the column they came through and a link to the record.

### Embedded board view (`DV-EMB-25`)

The block stores two ids — a board node and a saved view — and nothing else.
[`use-embedded-board.ts`](../src/hooks/use-embedded-board.ts) reuses the query
engine (`resolveColumns`, `queryRowIds`), the cell renderers and the cell
editors, and its writes take the same optimistic → reconcile → rollback path as
the board's own store, using the same pure operations. A deleted board renders
the missing-board state; the page around it is unaffected.

---

## Known limitations of this implementation

- Popover editors (select, user, attachment, relation) are positioned inside the
  scroll container, so one opened on the last visible row can be clipped. A
  portal with collision detection is the fix.
- Search recomputes across every row on each keystroke. At 5.000 rows that is
  ~10 ms; it needs debouncing or an index before the dataset grows.
- Row virtualisation assumes a fixed row height per view (`short` / `medium` /
  `tall`). Variable-height rows would need measurement.

Collaboration — comments, mentions, watching, the inbox, My Work, global
search, favorites and recent — is documented separately in
[COLLABORATION.md](./COLLABORATION.md).

Bulk actions, import, export, archive, trash, version history and the record
activity log are documented in [SYSTEM.md](./SYSTEM.md). Three of them reach
into the board engine directly: bulk writes go through dedicated endpoints
rather than the single-cell one, archived records are excluded from
`queryRowIds` unless the view asks for them, and every write now records
*what* changed — column, before, after — for the drawer's Activity tab.
