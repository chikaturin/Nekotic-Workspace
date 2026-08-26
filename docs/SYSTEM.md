# System engine — architecture report (FUNC 34–40)

`SY-BLK-34` bulk actions · `SY-IMP-35` import · `SY-EXP-36` export ·
`SY-ARC-37` archive · `SY-TRH-38` trash · `SY-VER-39` version history ·
`SY-ACT-40` activity history

---

## 1. What these seven have in common

None of them create a new kind of data. Every one operates on records or nodes
that already exist, so the layer is built out of three shapes rather than seven
subsystems:

| Shape | Answers | Used by |
| --- | --- | --- |
| **request** | "do this to these ids" | bulk, import, move |
| **plan** | "here is what *would* happen" | import mapping and validation |
| **report** | "here is what happened, including what did not" | bulk, import, export, restore |

The report shape is the one that matters. A bulk write that silently drops a
record is worse than one that refuses, so `applied` and `skipped` together
always account for every id the caller sent.

---

## 2. Bulk actions (`SY-BLK-34`)

### One request, never a loop

The brief is explicit: *do not mutate row by row if the backend has a bulk
endpoint.* It has one — four, in fact:

```ts
boardService.bulkUpdate({ boardId, rowIds, values })      // status, assignee, any column
boardService.bulkArchive({ boardId, rowIds, isArchived })
boardService.bulkDelete({ boardId, rowIds })
boardService.bulkMove({ boardId, rowIds, targetNodeId })
```

`useBulkActions` calls exactly one of them per action with the whole selection.
The regression test asserts the shape of the guarantee rather than the effect:
100 records go through `bulkUpdate` **once**, and `updateCells` — the single-row
endpoint — is never called at all.

### Partial success is a first-class answer

```ts
interface BulkResult {
  requested: number;
  rows: BoardRow[];      // authoritative records for the ids that changed
  applied: string[];
  skipped: { rowId; displayId; reason: "archived" | "not_found" }[];
}
```

`partitionBulkTargets` ([`lib/bulk.ts`](../src/lib/bulk.ts)) splits the requested
ids before anything is written, and the toast reports both halves:
`Updated 97 records · 3 skipped (archived)`. The bar itself says what will be
skipped *before* the click, because a warning after the fact is an apology.

Per-row ACLs are a backend concern. When they land they report through this same
channel — one more `reason` — rather than a second mechanism the UI has to learn.

### Selection

A map, not an array: `selectedRowIds: Record<string, true>` in the grid store, so
a row's checkbox subscribes to one boolean and ticking row 12 re-renders row 12.
Shift-click extends through the *view's* order, not the board's, so a range over
a filtered, sorted table means what it looks like it means.

Two details that are easy to get wrong:

- Ticks outlive their records — a delete or a move leaves stale ids behind.
  `useBulkActions` filters the selection against `rowsById` on every read, so a
  stale id can never reach a write.
- The row order changes on every cell edit. It is therefore **not** in
  `GridShared`; the shift-range reads it from a ref through a stable callback,
  because putting it in that object would re-render every visible row on every
  keystroke.

### Moving between boards

Two boards have different schemas, so cells travel through the same *conversion*
path a column type change uses: matched by name, then re-read into the
destination's type, with anything unparsable preserved as text. Columns the
destination has no counterpart for are reported by name —
`Moved 2 records to Bug Tracker · 7 columns had no match` — and the destination
assigns its own record ids.

---

## 3. Import (`SY-IMP-35`)

```
upload → map columns → validate → confirm → result
```

Everything before *confirm* is a pure function over the parsed file. The board is
not touched until the last step, which is what makes the error list actionable:
the user sees exactly which rows will fail while they can still change the
mapping.

| Step | Where | What it does |
| --- | --- | --- |
| upload | `parseXlsx` / `parseDelimited` | XLSX, CSV and TSV all become one `Grid` |
| map | `autoMapColumns`, `setMapping` | exact name match, then containment; each board column claimed once |
| validate | `planImport` | parses every mapped cell, reports per row what the column could not read |
| confirm | `rowsToCreate` + `boardService.importRows` | one call; the board assigns `TASK-042 … TASK-141` |

Two answers are offered for rows that hold a value a column cannot read, because
the PRD gives two: **leave those rows out**, or **import them with the flagged
cells empty**. Neither is chosen silently.

Rows with nothing in any mapped column are counted and dropped — trailing blanks
are an artefact of the spreadsheet, not data. A file longer than
`IMPORT_MAX_ROWS` is truncated *and says so*.

---

## 4. Export (`SY-EXP-36`)

Three writers, one projection:

```
columns + rows ──▶ buildExportGrid ──▶ Grid ──┬─▶ buildXlsx
                                              ├─▶ toDelimited (UTF-8 BOM)
                                              └─▶ buildPdf (paginated)
```

Because every format reads the same rectangular projection — built from the
cells' plain-text form, the representation copy, search and column conversion
already share — the three files cannot disagree about what a record says.

**Scope** is `board` (everything), `view` (filters, sort and search applied) or
`selection` (the ticked records). The dialog shows the record count for each, so
picking one is not a guess.

**Columns the viewer may not read never reach a writer.** `selectExportColumns`
removes them from the projection itself, and the dialog names what was withheld.
Column-level ACLs are a backend concern; until they exist the test is the column
*name* (`secret`, `token`, `api key`, `password`, `credential`), gated on the
workspace `manage` capability. It is deliberately conservative: a column called
"API key" leaves the file rather than leaking into a spreadsheet somebody mails
on.

Two writer fixes came out of this: the PDF generator now paginates (a 200-line
export used to draw everything past the thirty-second line off the bottom of
page one) and substitutes glyphs its single-byte font cannot draw, and the XLSX
writer sanitises sheet names, because Excel refuses to open a workbook whose
sheet is called `Q3: Launch`.

---

## 5. Archive (`SY-ARC-37`)

Archiving is *freezing*, not hiding: the content stays readable, searchable and
addressable, and every write path closes until it is restored.

It applies at two levels, and they are deliberately different:

| | Freezes | Restored from |
| --- | --- | --- |
| **Node** — project, folder, board, page | itself *and everything under it* | the node itself, or the Archive view |
| **Record** — a board row | itself | the bulk bar, the row menu or the drawer |

The node case is **inherited**, and nothing branches on `node.isArchived`
directly. [`lib/archive.ts`](../src/lib/archive.ts) resolves it:

- `archiveSourceOf(tree, id)` — the outermost archived node at or above `id`.
  This is what the banner names, because restoring a page inside an archived
  project would not actually unfreeze it.
- `inheritedArchiveOf(tree, id)` — the same search *excluding* the node itself.
  This is what `useCapabilities` narrows on, so you can always restore the thing
  you are standing on, while an inherited freeze is absolute.

On a frozen board: the fields go `inert` (out of the tab order, not merely
un-clickable), the grid refuses Enter-to-edit, type-ahead, paste, cut and
Delete, the column menus and the inline add-row disappear, and Import is
disabled. **Export stays enabled** — archiving stops writes, not reads.

---

## 6. Trash (`SY-TRH-38`)

### Deleting detaches

The PRD names an edge case that decides the whole design: *restore a document
whose parent folder has since been permanently deleted.* If deleting only set a
flag in place, purging the folder would take the already-deleted child with it
and that case could never occur.

So deletion **detaches**: the subtree leaves the tree and is held in a bin with
the record of where it came from.

```ts
interface TrashEntry {
  node: DriveNode;              // the whole subtree, flagged
  deletedAt: string;
  deletedBy: UserSummary;
  originalAncestorIds: string[]; // root → parent, resolved at deletion
  originalPath: string;          // "Development / Backend", resolved while it still resolves
}
```

`originalPath` is computed *at deletion*, because after a purge there is nothing
left to compute it from.

### Restoring says where it landed

`restoreTargetFor` prefers the original parent, then walks *up* the recorded
ancestor chain to the deepest container still standing, and falls back to the
workspace root — never to nowhere. When the target is not the original, the
restore reports it:

> Restored "Payment" to Development — its original folder no longer exists

The Trash view flags it before the click too, so the surprise never happens.

Retention is `TRASH_RETENTION_DAYS = 30`; the days-remaining column counts down
and reads `due` once the window has passed. The backend owns the sweep — the UI
reports the deadline rather than inventing the deletion.

Records are not in the trash. The PRD scopes soft delete to folders, documents,
boards and files, so deleting a board row is permanent and the confirmation says
so plainly.

---

## 7. Version history (`SY-VER-39`)

One surface for three subjects, because the difference belongs in the data:

```ts
interface VersionEntry {
  version: number;
  createdAt: string;
  author: UserSummary;
  summary: string;         // "+3 −1 lines"
  lines: string[];         // the snapshot, as text
  hasSnapshot: boolean;    // false ⇒ neither compare nor restore is offered
}
```

| Subject | Snapshot | Restore |
| --- | --- | --- |
| Page | blocks rendered to lines, structure included (`## Heading`, `[x] done`) | yes |
| Config document | the file's contents | yes |
| Secret document | **none** — the rotation record only | no |

A secret's history records *that* a key rotated and by whom. There is no
snapshot because the client never holds the plaintext to snapshot, and diffing
masks would say nothing true. The dialog says so where the restore button would
otherwise be, and its subtitle changes to match.

**Restoring writes a new version rather than rewinding**, so the record of what
happened stays complete: restoring v1 over v2 produces v3, and v2 is still on
record. Restores go through the same `save` a keystroke does, which is why a
locked page refuses one for exactly the reason it refuses an edit.

The diff is a longest-common-subsequence over lines, so an edit in the middle
reports as one added and one removed line instead of rewriting everything below
it. Added lines are green, removed lines are red.

Two details worth keeping:

- History loads **only while the dialog is open**. A list read at mount is stale
  by the time somebody opens it — the page has been edited since.
- Restoring is the one place a page action *replaces* the editor draft.
  Pin, lock and archive protect unsaved work; a restore is a content change, so
  it would be wrong to leave the old draft sitting on top of it.

---

## 8. Activity history (`SY-ACT-40`)

The log is structured at the point of writing, not parsed at the point of
reading:

```ts
interface ActivityEntry {
  kind: "created" | "updated" | "commented" | "attached"
      | "archived" | "restored" | "imported" | "moved";
  actor: DirectoryUser;
  summary: string;                                   // "changed Status"
  changes: { columnName; from; to }[];               // already rendered as text
  createdAt: string;
}
```

`from` and `to` are the text the *column* renders — never an option id, never a
payload. The drawer's Activity tab reads exactly that:

```
Today
16:20  KL  Khanh Luu changed Status
           STATUS   Done → In review
10 Aug 2026
16:30  KL  Khanh Luu created TASK-001
```

**One write is one entry**, however many fields it touched: changing Status and
Due Date together is a single line with two changes under it, not two lines
racing for the same second. A write that changes nothing records no change rows.

The drawer keeps Details, Comments and Activity as tabs, all three mounted, so
switching to the history and back never costs a half-typed comment.

---

## 9. What a real backend still has to provide

| Contract | Why |
| --- | --- |
| `POST /boards/:id/records:bulk` | the four bulk endpoints, returning `applied` + `skipped` |
| Per-row ACLs in the skip channel | the PRD's "some rows are not yours to edit" case |
| `POST /boards/:id/records:import` | server-assigned ids for a batch |
| Column-level read permissions | so export gating is a rule, not a name test |
| `GET /nodes/trash` + retention sweep | the bin, and the deadline the UI reports |
| `GET /documents/:id/versions` | snapshots and restore-as-new-version |
| An append-only activity stream | so the log is not this client's memory |
| Server-side export for large boards | 5.000 records is fine in the browser; 500.000 is not |

---

## Known limitations of this implementation

- **The trash bin lives in the workspace store**, so it is per session like the
  rest of the mock tree. Retention is computed from `deletedAt` against the
  frozen clock; nothing actually sweeps.
- **Export runs in the browser.** Excel and CSV are streamed from one projection
  and are fine at board scale, but a 500.000-record export belongs on the
  server. The PDF writer draws text, not tables: one line per record, clipped to
  the page width, with no column rules.
- **Export column gating is name-based** (`secret`, `token`, `api key`,
  `password`, `credential`) and keyed to the `manage` capability. It is the
  honest stand-in for a column ACL, and it errs towards withholding.
- **Import maps a single sheet.** A multi-sheet workbook imports its first
  worksheet; relation columns almost always report as unreadable, because the
  target board's records are not addressable from a spreadsheet cell.
- **Move matches columns by name only.** A destination column with the same name
  but an incompatible type takes the value through the conversion path, which
  may preserve it as text rather than parse it.
- **Record archiving is a board-level state**, not a separate store: archived
  records still count towards the board's total and still appear in exports
  scoped to the whole board.
- **Version history is capped** at `VERSION_HISTORY_LIMIT` snapshots per
  document, and config history is unbounded only because the mock service
  predates the cap.
- **Activity is the board record's own memory.** It is not written for boards
  this session has never loaded, and a permanently deleted record takes its
  history with it.

---

## Related

Roles, the permission catalogue, inheritance, the audit log and the dashboard
are in [GOVERNANCE.md](./GOVERNANCE.md). Three of the features above became
permission-gated there: archiving takes `node.archive`, record deletion takes
`row.delete`, and export drops any column the caller may not read. The audit
log also picked up what this layer records — bulk deletes, imports, archives —
alongside the secret trail it started from.
