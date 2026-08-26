# Governance — architecture report (FUNC 41–45)

`SY-AUD-41` audit log · `SY-RBC-42` RBAC · `SY-INH-43` permission inheritance ·
`SY-DSH-44` dashboard · `SY-POS-45` product positioning

---

## 1. The one thing to read first

**Nothing in this layer is enforcement.** A hidden button, a disabled menu item
and a greyed toolbar are courtesies to the person using the app: they say "this
is not for you" before a request is sent and refused. They are not a security
boundary, and they cannot be, because every one of them lives in code the
client controls.

The backend must re-check every permission key in this document on every call.
The catalogue below exists so it has an exact list to check against — the same
list the interface reads — rather than a set of rules reverse-engineered from
what the UI happens to hide.

The app says this out loud in the one place someone is most likely to forget
it: the footer of the permission dialog, next to the role controls.

---

## 2. RBAC (`SY-RBC-42`)

### One question, one API

The brief is explicit: *do not write `if (role === "admin")` scattered across
components.* Nothing does. Components ask for a key:

```tsx
const can = usePermissions(node);

<Button disabled={!can("board.column.create")}>Add column</Button>
<Button disabled={!can("row.update")}>Change status</Button>
{can("secret.reveal") && <RevealButton />}
```

`can` is the only way a surface finds out what it may offer. It resolves
through [`lib/permissions/evaluate.ts`](../src/lib/permissions/evaluate.ts) and
nothing else in `src/` compares a role to a literal.

That last claim is a test, not a convention. [`tests/rbac.test.ts`](../tests/rbac.test.ts)
walks every `.ts` and `.tsx` file under `src/`, excludes the permission library
itself, and fails if any of them contains a role comparison. A scattered check
is one refactor away at all times, and nothing else would catch it.

### The catalogue

36 keys, named `module.thing.action`, in [`types/permission.ts`](../src/types/permission.ts):

```
workspace.manage            node.create              board.create
workspace.member.manage     node.rename              board.manage
workspace.permission.manage node.move                board.column.create
workspace.audit.view        node.delete              board.column.update
                            node.share               board.column.delete
row.create                  node.archive             board.view.manage
row.update                                           board.template.manage
row.move                    document.create          board.import
row.archive                 document.update          board.export
row.delete                  document.lock
                            document.version.restore file.upload
comment.create                                       file.update
comment.resolve             secret.reveal            file.delete
comment.delete              secret.rotate
```

A key's **module is derived from its own first segment**, never declared beside
it — `board.column.create` is filed under `board` because it begins with it, so
a key cannot end up in the wrong group. That is asserted for all 36.

### The role matrix

Each role is the one below it **plus what it adds**, accumulated in
[`lib/permissions/roles.ts`](../src/lib/permissions/roles.ts). A permission can
therefore never be granted to Member and withheld from Manager by accident —
also a test.

| Role | Holds |
| --- | --- |
| **Viewer** | Nothing. Read-only means exactly that. |
| **Member** | Records (`row.create`, `row.update`, `row.move`), comments, uploads, sharing, export |
| **Manager** | Member + all structure: drive, boards, columns, saved views, templates, documents, archive, record deletion |
| **Admin** | Manager + the workspace itself: members, access rules, audit log, secrets |

Viewer holding **zero** keys is deliberate, not an oversight. Being able to see
a node is decided by access resolution, not by an action, so the Viewer column
of the matrix is empty by construction. It is the one column you can verify at
a glance.

The matrix is rendered on screen from that same table — the Roles tab of the
permission dialog *is* the rules, read out. A key that never reaches that table
is a key nothing could be gating on.

### Ownership is not a role

Five keys escalate for the owner of a node — `node.rename`, `node.delete`,
`node.archive`, `file.delete`, `document.lock` — at Member and above. You can
always tidy up what you made. Owning a folder does not make you a manager of
the boards inside it, which is also a test.

### Layers only ever narrow

```
role matrix  →  restricted?  →  trashed?  →  archived ancestor?  →  locked?
```

Every layer after the first can only take a permission away. A trashed node
accepts nothing but `node.delete`; an archived ancestor closes every write and
leaves reads — `board.export` included — open; a lock closes content writes but
not `document.lock` itself, so the person who locked a page can unlock it.

The property is asserted exhaustively rather than by example: for all 36 keys ×
4 roles, a narrowed answer is never `true` where the open answer was `false`.

### Where the coarse flags went

`CapabilitySet` (`edit`, `upload`, `delete`, `share`, `manage`) still exists,
because forty-odd surfaces branch on it. It is now a **projection** of the
catalogue rather than a parallel rule set — `capabilitiesFor` calls `can` for
each flag — so the two cannot drift. It also became more accurate on the way:
`edit` resolves to `document.update` on a page, `row.update` on a board,
`file.update` on a file and `node.rename` on a folder. One word, four
permissions, kept apart.

### Previewing as another role

The workspace switcher carries **Preview as**, reachable from every screen. It
narrows the interface to what the chosen role may do, and a standing banner
says so with an exit.

Previewing can only ever *remove* affordances: the effective role is
`min(your role, the previewed role)`. A member previewing as admin still sees a
member's app, because the alternative is a privilege escalation with a dropdown
in front of it.

---

## 3. Permission inheritance (`SY-INH-43`)

### Three states, said out loud

Access flows down the tree. A node with no rule of its own holds exactly what
its nearest ancestor says, and the workspace role is the floor under all of it.
Writing a rule on a node stops the flow there.

The dialog labels every row with where its access came from, because "Member"
alone is not something a person can act on — whether it arrived from the
project above or was written here decides what changing it will do:

| Badge | Means |
| --- | --- |
| **Workspace role** | Nothing is written anywhere on the chain. |
| **Inherited · Backend** | Flows down from that ancestor. |
| **Explicit** | Written here, and it happens to match what it would inherit. |
| **Override** | Written here, **replacing** what would have arrived. |

Explicit and Override are the same kind of rule — the difference is only
whether it changes anything, and that distinction is what tells you whether
deleting it is safe.

### Resolution

[`lib/permissions/inheritance.ts`](../src/lib/permissions/inheritance.ts)
walks root → node, so the last match is the most specific one:

- The **deepest** rule wins, not the strongest. A project-level grant of Manager
  is taken back down to Member inside one folder — which is the only reading
  under which an exception can be written at all.
- A rule naming the **person** beats one naming their **role** at the same node.
- A role-scoped rule gets a row of its own in the list, so a grant covering a
  group is never invisible just because it names nobody.

Each row also carries `inheritedRole` and `inheritedFrom` — what the subject
*would* have had — which is what makes "Reset to inherited" a button whose
outcome you can predict before pressing it. Rows that are merely flowing
through have nothing to reset, and their button says so.

### Everything a rule writer does is audited

`setAccessRule` and `clearAccessRule` on [`store/permission-store.ts`](../src/store/permission-store.ts)
are the only two ways a rule changes, and both append to the audit log with a
sentence rather than a diff:

> Duc Pham set to Member on this folder, overriding Manager.

Clearing a rule that was not there records nothing, because nothing happened.

---

## 4. Audit log (`SY-AUD-41`)

### Read-only by construction

The requirement is that the audit log has no Edit and no Delete. It does not
have them because **the service has no such call**:

```ts
export const auditService = { record, list, reset };  // reset is the test seam
```

There is no update path and no delete path, so no screen can grow a button that
quietly works. The first test in [`tests/audit.test.ts`](../tests/audit.test.ts)
asserts the shape of that object, because a missing capability is the only kind
of guarantee a UI cannot undo. The page states it where someone would look for
the button: *Append-only · entries cannot be edited or deleted.*

### The six columns

| Timestamp | Module | Action | Actor | IP | Severity |
| --- | --- | --- | --- | --- | --- |
| `26 Aug 2026 · 16:19` | Secrets | Reveal secrets · `STRIPE_SECRET_KEY` **denied** | Hai Vo | `10.4.31.87` | **Error** |

- **Timestamp** is absolute, never "3 hours ago". An audit row is evidence.
- **Module** is a module the RBAC catalogue governs, plus `system` for events no
  user initiated. The two vocabularies are the same vocabulary.
- **Action** is written as a **permission key** wherever one governs it, and
  rendered through the catalogue's label — so a row can be traced back to the
  permission that allowed or refused it.
- **IP** is stamped by the service. A real backend reads it off the socket; the
  client never sends one, which is why it is set in the service and in no hook.
- **Severity** is Info / Warn / Error. A refusal defaults to Error, a privileged
  read to Warn.

The `detail` column under each action is a **sentence the service wrote**, never
a payload rendered as JSON — the same rule the activity timeline follows.

### What reaches it

Secret reveals feed it from `devtools-service`, allowed and refused alike: a
refusal nobody can see is not a control. Access-rule writes feed it from the
permission store. Filters narrow by module, severity, actor and free text
across every column on screen; the severity tally counts the **matches**, not
the page.

---

## 5. Dashboard (`SY-DSH-44`)

### Three readings, one record set

The dashboard owns no data. Every number is a count over records that live on a
board, which is why clicking a source on a card lands on the real thing.

| Widget | Buckets |
| --- | --- |
| **Tasks** | Todo · Doing · Review · Done |
| **QA** | Passed · Failed · Blocked |
| **Deadlines** | Overdue · Today · This week |

### Reading a label, not an id

Boards come from different templates, so the widgets cannot address a status by
id. They read the **label** — what the user actually sees — and place it in a
bucket, which is how a bug board's `Triaged` and a task board's `To do` land
together in Todo.

A board is read as **QA** when its status column speaks in verdicts (`Passed` /
`Failed`), not when it was made from the QA template. A board created from a
template and then reshaped should follow what it became.

### Unmapped is reported, not folded away

A label no bucket claims — `Won't fix`, `Not run` — is counted as **unmapped**
and shown on the card: *68 records in another state*. A count you cannot trace
is worse than a gap, and quietly rounding `Won't fix` into Done would make the
Done number a lie. Every record the widget saw is either in a bucket or in that
footnote; the test asserts the two add up to the record count.

Deadlines only count work that is still **open**. A finished task that missed
its date is history, not something to chase.

### Loading, empty, error

- **Loading** — three widget skeletons matching the card layout.
- **Empty** — a widget with nothing in it says so inside its own card, so the
  other two stay readable.
- **Error** — one panel with the reason and a retry. The failing service rejects
  rather than reporting zeroes, because zeroes look like an answer.
- **New workspace** — three empty widgets tell a new team nothing, so the whole
  grid is replaced by one CTA: *Create your first task board*. It is still
  permission-gated, since a viewer cannot create one.

The empty workspace is a place you can stand rather than a branch nobody
reaches: **Atlas** in the workspace switcher ships with nothing in it.

---

## 6. Product positioning (`SY-POS-45`)

The brief is a boundary, not a feature: stay inside **Organize · Connect · View**,
and do not invent Workflow Automation, an API Gateway or an Email Client.

What was built maps onto the three pillars and nothing else:

| Pillar | This release |
| --- | --- |
| **Organize** | Access rules on the tree, the role matrix, archive and trash gating |
| **Connect** | Nothing new. The audit log *records* collaboration; it does not add a channel. |
| **View** | The dashboard — three readings of records that already exist |

Deliberately **not** built, despite being adjacent and tempting:

- **No rule builder.** "When status becomes Done, notify #releases" is workflow
  automation. Permissions decide who may act; they do not act.
- **No notification routing or digest scheduling.** The audit log has severities
  and an obvious next step of e-mailing the Errors. That step is an email
  client.
- **No API keys, rate limits or webhook surface.** `secret.reveal` governs
  reading a value that already exists. Issuing credentials is a gateway.
- **No approval flows.** "Request access" turns permissions into a workflow
  engine with a queue.
- **No custom roles.** Four roles, as specified. A role editor is a product
  decision, not an implementation detail.

Role preview is the one addition, and it is part of RBAC rather than beside it:
it is the only way to see the matrix take effect without four sign-ins.

---

## 7. What a real backend still has to provide

1. **Enforcement of all 36 keys**, per call, per node. The catalogue is the list.
2. **Per-node ACLs** with the same resolution order used here: deepest rule
   wins, user beats role, workspace role is the floor.
3. **Server-stamped audit entries** with a real client address, written inside
   the same transaction as the action — including refusals.
4. **Audit retention and export**, and immutability the client cannot assert.
5. **A dashboard aggregate endpoint.** Counting client-side means loading every
   record; at real volume this is one query per widget.
6. **Per-user view state**, so filtering a shared board stops writing to a view
   everyone else reads.
7. **Membership and role assignment**, including what happens to rules that name
   a person who has left.

---

## Known limitations of this implementation

1. **Frontend permissions are UX only.** Said again here because it is the
   single most important sentence in this document.
2. **Access rules live in a store**, so they last a session. There is no
   propagation, no conflict resolution and no audit of who read the list.
3. **Filter, sort, group and column visibility are ungated** — they are reading
   affordances — but they persist into the *shared* saved view. Per-user view
   state is the real fix; gating them would make a board unusable for a viewer.
4. **Bulk "Move to board" is gated on `row.delete`**, because it removes records
   from the source board. It is the destructive half that decides.
5. **Export is a Member action, not a Viewer one.** A viewer can read a board in
   the product; taking the data out is a step past reading. Reasonable products
   disagree, and it is one line in the matrix.
6. **The dashboard scans every allowed board on each load.** Fine at fixture
   size, wrong at real size — see the aggregate endpoint above.
7. **Deadline "this week" is a rolling 7 days from today**, not a calendar week.
8. **IP addresses are fixtures.** Only a server can attribute a call honestly.
9. **Role preview is not a session switch.** It narrows what the interface
   offers; it does not re-authenticate, and a reload clears it.
