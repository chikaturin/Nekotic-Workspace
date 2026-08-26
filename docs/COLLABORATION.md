# Collaboration — architecture report (FUNC 26–33)

`CO-CMT-26` comments · `CO-MEN-27` mention · `CO-WAT-28` watch ·
`CO-NOT-29` notification centre · `CO-MYW-30` my work · `CO-SCH-31` global
search · `CO-FAV-32` favorites · `CO-REC-33` recent

---

## 1. One address for everything

Eight features that all point at *things in the workspace* would otherwise
each invent their own target shape. They share one instead:

```ts
interface EntityRef {
  kind: "project" | "folder" | "board" | "document" | "file" | "row";
  nodeId: string;            // drive node — the routing anchor
  rowId?: string;            // board record
  boardId?: string;
  label: string;             // denormalised, so a notification renders without a lookup
}
```

`refKey(ref)` is the storage key (`row:brd_x:row_y`, `document:nd_z`);
[`lib/entity-ref.ts`](../src/lib/entity-ref.ts) is the only place that knows the
format. Because a comment, a watch, a notification, a search hit, a My Work item
and a recent entry are all addressed the same way, opening any of them is one
function — [`useOpenEntity`](../src/hooks/use-entity-navigation.ts):

| Target | What happens |
| --- | --- |
| file | opens the preview overlay |
| record | routes to the board, then asks it to open the drawer |
| anything else | plain navigation |
| node deleted since | reports it, instead of dropping the user at `/drive` |

The drawer intent cannot travel in the grid store — that store is reset for
every board that loads — so it is parked on the workspace store as
`rowRequest: { nodeId, rowId, nonce }` and consumed by `BoardPage` once its
records are ready. A record that no longer exists says so.

---

## 2. Realtime: a transport, not a socket

The backend exposes no realtime endpoint, so building a socket client would be
inventing an architecture the server cannot answer. What ships is the seam:

```
RealtimeTransport ── connect / close / publish / subscribe / status
      ↑
createTransport()      REALTIME_ENDPOINT === null → createLocalTransport()
      ↑
RealtimeClient    ── exactly-once delivery, then fan-out to subscribers
```

- [`lib/realtime/transport.ts`](../src/lib/realtime/transport.ts) — the interface
  and the in-process bus. A socket implementation replaces one factory branch;
  nothing above the line changes.
- [`lib/realtime/client.ts`](../src/lib/realtime/client.ts) — the shared client.

### Why events cannot duplicate cached state

Two independent guarantees, because either one alone can be defeated:

1. **Delivery** — every frame carries an id, and the client remembers the last
   512 it delivered. A reconnect replay, or a server echo of a write this tab
   already applied, is dropped and counted in `duplicatesDropped`.
2. **Application** — every writer goes through an id-keyed upsert
   (`upsertComment`, `upsertNotification`). Applying the same record twice
   replaces it rather than appending, so even a frame that gets past the first
   guard cannot double-count.

The unread badge is *derived* from the inbox (`countUnread`), never incremented,
which removes the third way a count can drift.

A local write travels the same path as a remote one: `realtime.emit()` publishes
through the transport and comes back to this tab's subscribers. There is no
"apply locally, also broadcast" branch that could behave differently.

---

## 3. Comments (`CO-CMT-26`)

One store, keyed by `refKey`, so a record drawer and a page share the same
thread model, reply rules and fan-out — [`services/comment-service.ts`](../src/services/comment-service.ts).

| Requirement | Where it lives |
| --- | --- |
| comment | `commentService.add` |
| threaded reply | `parentId`, resolved through `rootIdFor` |
| attachment | `commentService.attach` → session object URL |
| edit | `commentService.edit`, author-only |
| edited label | `isEdited`, set by the service, never by the UI |
| draft | [`use-comment-draft.ts`](../src/hooks/use-comment-draft.ts) |

The composer stays editable while a post is in flight, so sending clears **only
the text that was actually submitted** — a sentence typed during the round trip
survives. Attachments are filtered the same way.

The mock's name-based failure switch is deliberately *not* applied to a comment
body: it matches the substring `fail`, which would make "the check is failing"
an unpostable sentence. Comments honour the global simulation switch instead.

**Threads are two deep, by construction.** A reply to a reply resolves to the
same root, so the model can never grow a third level that the renderer would
have to guess how to indent.

**Editing is admitted, not hidden.** Only the author may edit; every edit sets
`isEdited` and the item renders `· edited` with the edit time in its tooltip.

**Drafts survive the drawer.** The composer reads its value from an external
store keyed by `targetKey` (plus the root id for a reply composer), so switching
records swaps the draft with no syncing effect, and a viewer whose storage is
blocked still gets a working composer from the in-memory half.

**Optimistic posting converges.** The composer inserts a `tmp_` comment, the
service answers, and the realtime frame for the same write arrives too — all
three go through `upsertComment`/`replaceComment`, which is written as
remove-then-upsert precisely so both orders end on one copy.

---

## 4. Mentions (`CO-MEN-27`)

A mention is stored as `@[Mai Tran](usr_mai)`: the id is what the fan-out reads,
the label is what renders. All of the text arithmetic is pure and lives in
[`lib/mentions.ts`](../src/lib/mentions.ts).

| Step | Function |
| --- | --- |
| search members | `mentionCandidates(people, query)` |
| keyboard navigation | `useMentionPicker` — ↑ ↓ Enter Tab Esc |
| choose user | `applyMention(text, range, user)` → new text + caret |
| render mention token | `parseBody(body)` → text / mention / record segments |

Four details decide whether the picker actually feels right:

- **It only opens at a word boundary.** `mail@nexdrop.io` never opens it, and a
  finished token cannot re-open it (its query would start with `[`).
- **`handleKeyDown` reports whether it consumed the key**, so Enter means
  "pick this person" while the list is open and "newline" when it is not — the
  composer's own ⌘↵ shortcut can never fire underneath a selection.
- **The textarea does not re-sync on a key the picker consumed.**
  `preventDefault` stops the caret moving but not the key-up from firing, so
  without that guard every ↓ would be undone by its own release and Enter could
  only ever pick the first candidate.
- **Escape is layered.** The picker takes the first press, the composer's own
  handler the second, and only then does the surrounding drawer see one. A
  dialog's Escape listener runs in the capture phase on `document`, so stopping
  propagation from inside is too late — the textarea marks itself
  `data-escape-owner` and the drawer stands down when the press came from it.

Former members are resolvable but **not mentionable**: notifying an inbox nobody
reads is worse than nothing.

A mention of the signed-in user renders as a solid accent chip rather than a
soft one, so "somebody is talking to me" reads without opening the notification.

---

## 5. Watch (`CO-WAT-28`)

Records, documents and boards can be followed; a file or a folder has no
activity stream, and asking to watch one is **rejected** rather than silently
ignored. Watches are stored per user in
[`services/watch-service.ts`](../src/services/watch-service.ts), exactly as a
backend would, so the comment fan-out can ask "who should hear about this?"
without the UI assembling a recipient list.

The store keeps the set as `Record<targetKey, true>` so a button subscribes to
**one boolean** — toggling a watch re-renders that button and nothing else.
The write is optimistic with a rollback, and the toast names the target.

Commenting on something starts following it. Without that rule the Following
tab stays empty for everybody who never found the button.

---

## 6. Notification centre (`CO-NOT-29`)

Notifications are addressed to a recipient, so `list()` can only ever return
the signed-in user's, and `markRead` ignores ids outside that inbox.

Tabs are a **projection of `reason`**, not a second field — a notification can
never disagree with the tab it lands in:

| Tab | Reasons |
| --- | --- |
| All | everything |
| Mentions | `mention` |
| Assigned | `assigned` |
| Following | `watch`, `comment` |

Everything that creates a notification goes through `notificationService.emit`,
which also publishes the realtime frame. There is no second path that could put
a notification on screen without the inbox knowing about it.

**Opening is reading.** Clicking a row marks it read *and* routes to its
target, so the two can never diverge. Routing is `useOpenEntity`, which is why a
record notification lands on its board with the drawer open, a page notification
opens the page, and a system notice with no target simply marks itself read.

The same feed component serves the header popover and the full page; only the
density differs.

---

## 7. My Work (`CO-MYW-30`)

Five readings of one record set — never five queries, and never a separate
"my work" dataset that could drift from the boards.

My Work spans boards built from different templates, so it cannot address
columns by id. [`lib/my-work.ts`](../src/lib/my-work.ts) picks them **by role**:

| Role | Rule |
| --- | --- |
| assignee | a user column named like an assignee, else the first user column |
| due | a date column named like a deadline — nothing else |
| status | a select column named like a status, else the first select |

A board with no column for a role contributes nothing to the widgets that need
it, rather than guessing. That is why "Found on" and "Executed on" do not make a
QA case overdue: they are history, not work that is due.

Mentions are gated by the same predicate as boards, keyed by node id. A record
whose board is out of reach is **dropped** rather than falling through to the
page branch, which would otherwise name and link a record the user cannot open.

| Widget | Filter |
| --- | --- |
| Assigned to me | assigned + open |
| Mentioned | comments naming me, de-duplicated per thread |
| Due today | assigned + open + deadline on the reference day |
| Overdue | assigned + open + deadline before it |
| Recently updated | assigned, created or watched by me, touched in 7 days |

`DONE_LABELS` decides what "open" means (`done`, `verified`, `fixed`, `passed`,
`won't fix`, …), so a finished record leaves every open widget at once.

Each card shows the **match count**, not the rendered count, so a capped list
never reads as the whole story.

Permission is passed *into* the service as a predicate, so a board the user
cannot open is never read — filtering results afterwards would mean the client
had already seen them.

---

## 8. Global search (`CO-SCH-31`)

⌘K on macOS, Ctrl+K elsewhere (`mod+k` resolves to either).

Everything searchable is reachable from the drive tree, so **permission is
resolved once, at the node, with inheritance**: `collectAllowed` prunes a
restricted folder together with its whole subtree, and every result kind
inherits that — a record inside a board you cannot open is never scanned, and a
comment on it is never returned.

Results are grouped by kind, in a fixed order:

| Group | Source |
| --- | --- |
| Documents | drive nodes, name then excerpt |
| API endpoints / Bugs / QA cases | records, bucketed by their board's template |
| Records | every other board record |
| Files | drive nodes, name then excerpt |
| Comments | comment bodies, with a snippet around the match |
| Places | projects, folders and boards |

Ranking is explainable rather than fuzzy — exact (100) › prefix (70) › word
start (50) › loose substring (30) — so the result order is reproducible in a
test. A record-id match scores 90, above any title match, which is what makes
"Row ID" search work: `API-003`, `api 3` and `API-0` all find `API-003`.

Body hits (comments, excerpts) are weighted at 0.4 so a name match always wins.
Each group is capped, so one noisy board cannot crowd out every other kind.

Keystrokes are debounced 180 ms before reaching the services, because a search
scans every board the user can see.

With an empty query the palette shows **Recent** instead — the fastest path back
to what you were doing.

---

## 9. Favorites (`CO-FAV-32`) and Recent (`CO-REC-33`)

**Favorites** adds no second list. Starring already lives on the drive node, so
the view groups what the tree knows — which is why un-starring here updates the
sidebar and the drive grid in the same frame. Groups: projects, folders, boards,
documents, files.

**Recent** is a genuine least-recently-used list of the last 10 places visited,
not a "changed in the last 7 days" filter. `touchEntry` moves a revisit to the
front and drops the tail past the limit
([`lib/lru.ts`](../src/lib/lru.ts)). Pages, boards, records and previewed files
record themselves; a folder is recorded by the drive view.

It is kept in this browser only, and it is read *after* mount so server and
client markup agree. Entries are validated on read — anything that does not look
like an entry is dropped rather than trusted — and every storage access is
guarded, so a blocked storage API costs the history and nothing else. Entries
are resolved against the live tree on render, so something deleted since the
visit says so instead of routing nowhere.

---

## 10. What a real backend still has to provide

| Endpoint | Why |
| --- | --- |
| `GET/POST /comments?target=` | the store is in-memory; `refKey` is already the wire key |
| `POST /comments/:id` | edit, with the author check server-side |
| `POST /uploads` for comment attachments | today they are session object URLs |
| `GET /members?q=` | the mention picker reads the mock directory through `useDirectory` |
| `GET/PUT /watches` | per-user watch sets |
| `GET /notifications`, `POST /notifications/read` | the inbox, paginated |
| `GET /search?q=` | server-side search — the client currently scans every board it can see |
| `GET /me/work` | the five widgets as one query |
| `WS /realtime` | the transport interface is already the contract |

## Known limitations of this implementation

- Search scans every board the user can see on each settled keystroke. At ~5.400
  records that is a few milliseconds after the first seed, but it is a scan, not
  an index — a real deployment answers this server-side.
- Notifications are not paginated; the inbox returns everything.
- Comment attachments are session object URLs, so they do not survive a reload.
  The board's attachment cell has the same limitation.
- The realtime transport is in-process: another tab or another user does not see
  your comment. That is the honest ceiling of a backend with no socket, and the
  seam to lift it is one factory branch.
- Recent lives in local storage, so it is per-browser rather than per-account.
- The composer is a plain textarea, so a mention shows as its raw
  `@[Name](usr_id)` token while you are writing; it renders as a chip once
  posted. A styled token in the editor needs a contenteditable surface.

---

The board engine is documented in [BOARD.md](./BOARD.md); bulk actions, import,
export, archive, trash, version history and the record activity log in
[SYSTEM.md](./SYSTEM.md). The activity log replaced the untyped `summary` string
this layer used to write for comments — `noteActivity` now feeds the same
structured stream the drawer's Activity tab renders.

Who may do any of it is settled in [GOVERNANCE.md](./GOVERNANCE.md): commenting
is a Member permission, resolving a thread is `comment.resolve`, and the audit
log records the privileged actions this layer only announces.
