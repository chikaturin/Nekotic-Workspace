# NexDrop — All-in-One Workspace (Drive Mode)

Workspace shell + file-tree manager built with **Next.js 16 (App Router)**, **TypeScript**,
**Tailwind CSS v4**, **shadcn-style primitives**, **lucide-react** and **Framer Motion**.

Design direction: *daylight blueprint* — white paper surfaces, cool hairline rules, dense rows,
monospaced metadata, one signal blue. Light is the default theme; the dark theme is a deep navy
rather than black (toggle in the sidebar footer). Motion is used only to stage information
(folder-open cascade, tree expansion, drag lift), never as decoration.

```bash
pnpm install
pnpm dev          # http://localhost:3000 → redirects to /drive
pnpm test         # 764 unit tests
pnpm test:coverage
pnpm build
```

## Routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Task, QA and deadline widgets over every board you can open — the workspace home |
| `/drive/[[...path]]` | Drive Mode. Path segments are node slugs: `/drive/development/backend/payment` |
| `/my-work` | Five readings of the boards you can open: assigned, mentioned, due today, overdue, recently updated |
| `/favorites` | Starred projects, folders, boards, documents and files, grouped by type |
| `/recent` | Least-recently-used list of the last 10 places you opened |
| `/notifications` | Inbox: All · Mentions · Assigned · Following |
| `/archive` | Frozen projects, folders, boards and pages — read-only, restorable |
| `/trash` | Soft-deleted items with their original location, who deleted them and how long is left |
| `/audit` | Append-only trail: timestamp, module, action, actor, IP, severity. Admin only |

## Layout

```
AppShell ─ src/components/layout/app-shell.tsx      ⌘K search · ⌘B collapse
├── AppSidebar (collapsible, 276px ⇄ 64px, spring width animation)
│   ├── WorkspaceSwitcher        tenant switch swaps the whole tree
│   ├── NewItemMenu              folder / board / upload into the open folder
│   ├── TreePanel                Projects — multi-level tree
│   └── SMART_VIEWS              Dashboard · Favorites · Recent · My Work · Notifications · Trash · Audit
│   └── StorageMeter + theme + collapse toggle
├── AppHeader
│   ├── BreadcrumbNav            NexDrop / Development / Backend / Payment
│   │                            · collapses to `…` past 4 levels
│   │                            · every crumb is a drop target (move up the tree)
│   │                            · sibling dropdown per crumb
│   ├── GlobalSearch → GlobalSearchDialog (⌘K / Ctrl+K, cmdk, grouped results)
│   ├── NotificationBell         unread badge · tabs · mark all read
│   └── UserMenu (avatar)
└── main → DriveView | MyWorkPage | FavoritesPage | RecentPage
                     | NotificationsPage | ArchivePage | TrashPage
```

## Drive Mode

`DriveView` resolves URL segments against the active workspace tree and renders:

- **container node** → `DriveCanvas` (drop zone) wrapping `DriveGrid` or `DriveList`
- **leaf node** (board/file) → `NodeDetail` metadata card
- **unknown segment** → `NotFoundState`

Both layouts share one item menu, one metadata formatter and one DnD contract, so grid and
list can never drift apart. Sorting, view mode and selection live in the store, not in the URL.

### Tree engines

Two interchangeable implementations behind `TreePanel`, selected by `TREE_ENGINE` in
[`src/config/app.ts`](src/config/app.ts):

| Engine | File | Notes |
| --- | --- | --- |
| `recursive` (default) | `components/tree/folder-tree.tsx` | Dependency-free recursion, unbounded depth, per-level Framer Motion height animation, native HTML5 DnD shared with the grid |
| `arborist` | `components/tree/arborist-tree.tsx` | `react-arborist` — virtualised rows via react-window, its own react-dnd drag layer, `ResizeObserver`-driven sizing |

### Drag & drop

Native HTML5 DnD, so OS file drops and internal moves use one code path
([`lib/dnd.ts`](src/lib/dnd.ts), [`hooks/use-node-dnd.ts`](src/hooks/use-node-dnd.ts)):

- internal nodes travel as `application/x-nekotic-node`; `text/plain` is set for external apps
- drop targets: folder cards, folder rows, tree rows, breadcrumb crumbs, the canvas background
- a target only highlights if it can *actually* accept the drop — self-drops, descendant-drops
  and same-parent drops are rejected before any state changes
- dropping OS files uploads them into the target folder (`uploadFiles`)

### Full-page file viewer

Opening a file takes over the whole viewport
([`src/components/files/file-preview-dialog.tsx`](src/components/files/file-preview-dialog.tsx)):

- The file fills the screen — images (fit ⇄ actual size), PDFs in the browser viewer, text and
  source with line numbers, wrap toggle and copy; anything else falls back to a metadata card
  plus **Download**.
- The **details rail** is open by default: location path, full metadata table, owner and status.
  `I` toggles it, `←` / `→` walk the folder's files, `Esc` closes.
- **Rename** is inline in the header; **text files are editable in place** (see below).
- In the drive grid, hovering a file card reveals a one-click **Preview** button — no
  double-click needed.

## Pages (WS-DOC-05)

Block-based editor at any `document` node in the drive, e.g.
`/drive/development/backend/payment/payment-integration-notes`.

| Area | Where |
| --- | --- |
| Block model + operations | [`src/types/document.ts`](src/types/document.ts), [`src/lib/blocks.ts`](src/lib/blocks.ts) |
| Slash commands + markdown shortcuts | [`src/lib/block-commands.ts`](src/lib/block-commands.ts) |
| Editor interaction | [`src/hooks/use-block-editor.ts`](src/hooks/use-block-editor.ts), [`src/components/document/block-row.tsx`](src/components/document/block-row.tsx) |
| Autosave state machine | [`src/lib/autosave.ts`](src/lib/autosave.ts) + [`src/hooks/use-autosave.ts`](src/hooks/use-autosave.ts) |
| Persistence | [`src/services/document-service.ts`](src/services/document-service.ts) |
| Full screen | `⤢` in the page header · `Esc` exits |

**13 block types** — H1/H2/H3, paragraph, quote, checklist, bulleted list, numbered list,
code (language picker, Tab indent, copy), an image **gallery** (as many pictures as you like —
click any of them for the full-page lightbox), attachment (upload + download), link (unfurled by
the link service), and a table.

**Interactions**

- `/` opens the command menu; typing filters, ↑↓ moves, Enter inserts, Esc closes.
- Markdown shortcuts: `# `, `## `, `### `, `- `, `1. `, `> `, `[] `, `\`\`\` `.
- Drag the grip handle to reorder; a line shows where the block will land.
- **Tables** carry their controls where the work is: a menu on every row and column (insert
  above/below/left/right, delete), one-click add bars along the right and bottom edges, a header-row
  toggle in the corner, and Tab/Enter in the last cell grow the table as you type.
- Keyboard: Enter splits at the caret, Backspace at position 0 degrades the style then merges,
  ↑/↓ cross block boundaries at the edges, Alt+↑/↓ moves a block (the keyboard equivalent of
  dragging), ⌘/Ctrl+Enter toggles a checklist item, ⌘S forces a save.
- Autosave fires 500 ms after the last edit. The indicator reports **Saving… / Saved / Error**,
  and the error state offers a retry. Leaving with unsaved work prompts the browser.

The page surface fills the width of the content area, and the **⤢ button in the header
takes it full screen** over the shell (Esc returns).

**Document actions** — Pin (surfaces the page in the sidebar), Lock, Duplicate, Move (folder
picker), Archive (goes to `/archive`), Delete (goes to Trash). A **locked page turns the editor
read-only and disables the insert toolbar**; the service also refuses writes to a locked page, so a
stale tab cannot overwrite it.

## File management (WS-FIL-06)

File manager at `/files` and `/files/<folder-path>`, mirroring the drive path.

- **Upload is a full page** ([`src/components/files/upload-dialog.tsx`](src/components/files/upload-dialog.tsx)):
  *Add files* — or dropping files anywhere on the listing — opens a full-viewport uploader with a
  hero dropzone, the accepted-type reference, and the queue with per-file progress, cancel and
  retry. Uploads keep running in the global tray when it is closed
  ([`src/store/upload-store.ts`](src/store/upload-store.ts)). Dropping onto the drive canvas, a
  folder card or a tree row still uploads straight to that folder.
- **Accepted**: PDF, PNG, JPG, XLSX, CSV, TXT and source code, up to 25 MB
  ([`src/lib/file-validation.ts`](src/lib/file-validation.ts)).
- **Preview**: images inline, PDFs in the browser viewer (the mock service generates a real,
  spec-valid PDF — [`src/lib/pdf.ts`](src/lib/pdf.ts)), text and source with line numbers and copy,
  **spreadsheets in a grid** (CSV, TSV and XLSX). Anything else shows the metadata card plus
  **Download**, so no file is a dead end.
- **Metadata**: name, type, size, owner, created (plus modified and version) —
  [`src/lib/file-metadata.ts`](src/lib/file-metadata.ts).
- **New blank files**: *New → File* (sidebar) or the page icon in the drive toolbar creates an
  empty `.txt`, `.md`, `.csv`, `.xlsx` or `.json` with real seed bytes
  ([`src/lib/file-templates.ts`](src/lib/file-templates.ts)) and opens it for editing.
- **Spreadsheets**: `.csv`, `.tsv` and `.xlsx` open in a grid with column letters and row numbers;
  *Edit* turns cells into inputs with row/column menus, edge add bars and Tab/Enter growth.
  `.xlsx` is read and written as a real workbook by a dependency-free reader/writer —
  [`src/lib/xlsx.ts`](src/lib/xlsx.ts) over [`src/lib/zip.ts`](src/lib/zip.ts) (stored entries for
  writing, the platform `DecompressionStream` for reading).
- **Editing**: text, Markdown and source files are editable in the viewer — *Edit* switches
  the surface to a textarea, ⌘S or *Save* writes through
  [`fileService.saveText`](src/services/file-service.ts), and the tree records the new size and
  version. Files are renamed inline from the viewer header. Both respect the `edit` capability.

## Async states

Every async surface renders through [`AsyncBoundary`](src/components/shared/async-boundary.tsx):
**loading** (skeletons), **empty**, **error** (retry when the error is retryable),
**permission denied** (its own panel, never a generic error), plus **upload error** per queue item.

Reachable on demand — the beaker menu in the file manager toolbar forces any of them:

| Trigger | Result |
| --- | --- |
| Simulation → Listing response | empty / network error / permission denied |
| Simulation → Fail every upload | upload error with retry |
| Simulation → Fail every page save | save indicator error with retry |
| Simulation → Latency | fast / normal / slow loading |
| Upload a file with `fail` in its name | that upload fails late, mid-transfer |
| Put `fail` in a page title | that save fails |
| Open `/drive/legal-vault` | permission denied (restricted vault, owned by someone else) |

Permission rules live in [`src/lib/permissions.ts`](src/lib/permissions.ts) and reach components
only as a `CapabilitySet`; no component re-derives them from roles or ownership.

## Review pass

The two features went through a multi-agent adversarial review (six independent
reviewers, each finding verified by a skeptic that tried to refute it). Fourteen defects were
confirmed and fixed; four claims were refuted and left alone. The ones worth knowing about:

| Defect | Fix |
| --- | --- |
| An edit made while a save was in flight was dropped | The scheduler re-reads the pending draft when a request lands ([`lib/save-scheduler.ts`](src/lib/save-scheduler.ts)) |
| Unmounting during the debounce lost the edit | `dispose()` flushes pending work by default |
| The drag grip was also a Radix menu trigger, which cancels pointerdown — so block dragging never started | Grip and `⋯` menu are now separate controls |
| Image/attachment/link blocks wrote back a document snapshot taken *before* their upload, reverting everything typed meanwhile | Editor actions read the latest blocks through a ref |
| Pin/Lock/Archive replaced the local draft with server state, dropping unsaved edits | An unsaved draft now wins over action results |
| Favorite/trash from a file row never updated the table | The listing renders from the live tree once the fetch succeeds |
| Upload permission was checked in one entry point out of four | The check moved into `startUploads`, the single funnel |
| `.xlsx` previewed as mojibake because "spreadsheet" was treated as text | [`lib/preview-strategy.ts`](src/lib/preview-strategy.ts) decides by extension, with binary containers listed explicitly |
| Closing a preview revoked an object URL that document image blocks still used | URLs are cached per asset and released together |
| A locked page kept focusable-but-dead block controls, and the code block swallowed Tab | Controls are removed when read-only; Tab only indents while editable |
| The slash menu was invisible to screen readers | Combobox pattern: `aria-expanded`, `aria-controls`, `aria-activedescendant` |
| Focus fell to `<body>` when the neighbouring block had no text field | Non-text blocks take focus on the row or their first control |
| Renaming a page changed its slug and broke the URL you were standing on | The slug is minted once, at creation |
| Block drops landed one slot off when dragging downwards | [`moveBlockToInsertionIndex`](src/lib/blocks.ts) accounts for the vacated slot |

## Layering

```
components/   presentation + wiring only
hooks/        React glue: state machines, effects, capability gating
services/     all I/O, latency, failure policy, permissions enforcement
lib/          pure functions — block ops, autosave reducer, upload queue, validation, permissions
types/        the contracts everything else depends on
```

Services are the seam a real API replaces: `documentService`, `fileService` and `linkService`
already take `AbortSignal`s, report progress, and throw `ServiceError` carrying a UI-ready
`AppError` that `AsyncBoundary` knows how to render.

## Collaboration

Comments, mentions, watching, the notification inbox, My Work, global search, favorites and
recent are documented in [docs/COLLABORATION.md](docs/COLLABORATION.md). Three shapes carry
the whole layer:

- **`EntityRef`** — one address for a project, folder, board, document, file or board record,
  so every feature that points at something routes through the same function.
- **`RealtimeTransport`** — the seam a socket plugs into. The backend has no realtime endpoint,
  so the in-process bus ships; events are deduplicated by id *and* applied through id-keyed
  upserts, which is what keeps a replayed frame from double-counting the unread badge.
- **`Comment`** — one thread model for records and pages alike, two levels deep by
  construction, with mentions encoded as `@[Name](usr_id)`.

The board engine is documented in [docs/BOARD.md](docs/BOARD.md).

## System engine

Bulk actions, import, export, archive, trash, version history and the record
activity log are documented in [docs/SYSTEM.md](docs/SYSTEM.md). None of them introduce a new
kind of data — they all act on records and nodes that already exist — so the layer is three
shapes rather than seven subsystems:

- **request** — "do this to these ids". One bulk endpoint per action, never a loop of
  single-row calls: 100 records is one round trip.
- **plan** — "here is what *would* happen". Import mapping and validation are pure functions
  over the parsed file, so the board is untouched until the user has seen which rows will fail.
- **report** — "here is what happened, *including what did not*". `applied` and `skipped`
  together always account for every id that was sent.

Two design decisions carry the rest. Archiving is resolved by *inheritance*
([`lib/archive.ts`](src/lib/archive.ts)) rather than copied onto children, so a board inside an
archived project is read-only without its own flag — and you can always restore the thing you
are standing on. Deleting *detaches* the subtree into a bin
([`lib/trash.ts`](src/lib/trash.ts)) instead of flagging it in place, which is the only way a
page can outlive the folder it was deleted from and be relocated — audibly — on the way back.

## Governance

Roles, permissions, inheritance, the audit log and the dashboard are documented in
[docs/GOVERNANCE.md](docs/GOVERNANCE.md). **Frontend permissions are UX only** — a hidden
button says "this is not for you" before a request is refused; it is not a boundary, and the
backend still has to re-check every key.

There is one way to ask, and no component compares a role to a literal:

```tsx
const can = usePermissions(node);
<Button disabled={!can("board.column.create")}>Add column</Button>
```

36 keys named `module.thing.action`, four roles (Viewer · Member · Manager · Admin) where each
is the one below it plus what it adds, and layers — restricted, trashed, archived, locked —
that can only ever *narrow* the answer. `CapabilitySet` survives as a projection of the same
catalogue rather than a second rule set, and resolves `edit` to the key the node actually needs.

Access flows down the tree, and the dialog says which of the three states each row is in:
**Inherited** (from an ancestor), **Explicit** (written here, same as it would inherit) or
**Override** (written here, replacing it). The deepest rule wins, not the strongest — which is
the only reading under which an exception can be written at all.

**Preview as** in the workspace switcher narrows the whole interface to another role. It can
only remove affordances: the effective role is `min(yours, previewed)`.

## Data model

[`src/types`](src/types) is the contract every other layer depends on:

```ts
DriveNode = ProjectNode | FolderNode | BoardNode | FileNode   // discriminated on `type`
ContainerNode = ProjectNode | FolderNode                      // the only drop targets
```

Type guards (`isFolder`, `isFile`, `isContainer`, `childrenOf`) keep the union safe at every
call site. `Workspace`, `StorageQuota`, `BreadcrumbItem`, `DriveLocation`, `SearchHit`,
`SortState` and `ViewMode` live alongside them.

Mock data is authored as a nested **spec** and hydrated into fully-linked nodes — ids, slugs
(de-duplicated per level) and `parentId` are derived, never hand-written
([`src/mock/factory.ts`](src/mock/factory.ts)). Timestamps are offsets from the frozen
`MOCK_NOW` clock so server and client markup always agree.

## State

`useWorkspaceStore` (zustand) holds the tree, expansion, selection, view mode, sort, preview
and sidebar state. Every mutation goes through the pure helpers in
[`src/lib/tree.ts`](src/lib/tree.ts) — `updateNode`, `removeNode`, `insertNode`, `moveNode` —
which return new forests and preserve identity for untouched branches, so React can skip them.
`useDndStore` is kept separate because drag state changes on every gesture.

## Swapping the mock for an API

1. Replace `TREES_BY_WORKSPACE` with your fetch layer; `DriveNode` is the wire format.
2. Keep the `lib/tree.ts` helpers — they are pure and framework-free — and call your API
   inside the store actions, applying the returned tree optimistically.
3. `DriveView` takes `segments` from a server component, so the page can be rendered from the
   server once the data source is real.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Global search |
| `⌘B` / `Ctrl+B` | Collapse / expand sidebar |
| `←` `→` | Previous / next file in the viewer, previous / next image in the lightbox |
| `I` | Toggle the details rail in the file viewer |
| `⌘S` / `Ctrl+S` | Save the page, or the file being edited |
| `Tab` / `Enter` | In the last table cell: add a row |
| `Enter` | Open the focused item |
| `Shift` + click | Tick a range of records between the last tick and this one |
| `@` | Open the mention picker in any comment composer |
| `⌘↵` / `Ctrl+↵` | Post the comment being written |
| `Esc` | Close overlay |

## Tests

`pnpm test` — 764 unit tests over the pure layers (tree algorithms, breadcrumbs, formatting,
slugs, DnD payloads, visual mapping, block operations, the autosave state machine, the upload
queue reducer, file validation, permissions, the board query engine, mention parsing, comment
threading, search ranking, the LRU, bulk partitioning, import mapping and validation, the
export projection, the line diff, archive inheritance, trash restore targets, the permission
catalogue and role matrix, access inheritance, audit formatting and dashboard bucketing), the
services (documents, files, links, boards, dev tools, comments, watches, notifications, search,
my work, audit, dashboard) and the stores (move, upload, pages, selection, workspace switch,
board, notifications, watch, recent, trash, access rules). Coverage thresholds are enforced at
80% in `vitest.config.mts`; the suite currently runs at 92% statements / 81% branches / 95%
lines.

Some of those tests assert a *contract* rather than an effect: that 100 records are written by
one `bulkUpdate` call and never by `updateCells`; that planning an import writes nothing; that a
withheld column does not appear anywhere in the exported bytes; that a page restored from
version 1 produces version 3 with version 2 still on record; that a document survives the
permanent deletion of the folder it was deleted from; that no file under `src/` compares a role
to a literal; that no narrowing layer can hand back a permission the role matrix withheld, for
all 36 keys across all four roles; and that the audit service exposes no call that could change
what was recorded.
