# Recursive Thesis Outline — Phase 1 Design (Data Model + CRUD + Tree UI)

> Replace the fixed two-level thesis structure (thesis → chapters → sections) with
> an **arbitrarily-deep recursive outline** the student controls: Part → Section →
> Chapter → Subtitle → … Each node carries a title, body, and (for export) an
> optional header/footer. This spec covers **Phase 1 only**: the data model, a safe
> migration, the server CRUD surface (MCP + REST), and the app tree UI + preview.
>
> **Out of scope (later phases):** Phase 2 = rich DOCX export mapping the tree to
> mdocxengine sections/headings/headers/footers/TOC. Phase 3 = front matter (cover,
> dedication, tri-lingual abstracts, lists of tables/figures, abjad numbering).

Status: **DRAFT — awaiting review.** Date: 2026-06-21.
Repos: `~/modakerati-server` (Hono + Drizzle, schema source of truth) and
`~/modakerati` (Expo app). Export engine context: `~/mdocxengine`.

---

## 1. Motivation

The current model is fixed at two levels: `theses → chapters → sections`. Real
Algerian *mémoires* (see `mdocxengine/samples/مذكرة فتيحة حساني.docx` and the
shared PDF) are a **deeper tree**:

```
Part   (depth 0)                ← top-level division
└─ Section (depth 1)            ← a Word "document section": its OWN header + footer
   └─ Chapter (depth 2)         ← also a Word section (header = chapter title, footer = page)
      ├─ Subtitle (depth 3)
      │  └─ Subtitle (depth 4)  ← arbitrary depth
      └─ Subtitle (depth 3)
```

> The student typed the ordering **"parts → sections → chapters → and so on."**
> Note the word **"section" carries two meanings** here, and we keep them distinct:
> (a) a **depth-1 label** in the outline, and (b) the **generic Word "document
> section"** concept — the header/footer-bearing unit. In the user's framing *every*
> node is a "section" in sense (b) ("introduction is a section with header and
> footer, chapter one is also a section…"). So in the data model **any** node may
> own a header/footer; the depth→label names (Part/Section/Chapter/Subtitle) are
> **display defaults**, confirmable in §9. The shared PDF happens to skip the
> depth-1 level (Part→Chapter directly) — that's fine; depth is flexible, labels are
> derived.

Two facts drive the design:

1. **The hierarchy is recursive and user-controlled** — the student decides how
   deep to nest. A fixed N-level schema cannot express this.
2. **Any node can be a Word document section** — carrying its own header (running
   chapter title) and footer (page number / academic year). The PDF shows abjad
   numbering (أ ب ج) in front matter and decimal (1 2 3) in the body — distinct
   per-section `sectPr` page-number formats.

`mdocxengine` already supports the whole export path (per-section headers/footers,
`Titre1–Titre4` heading styles → outline levels → auto-TOC, per-section page-number
formats). So Phase 1 only needs to get the **data model** right; the heavy export
work in Phase 2 is de-risked.

---

## 2. Goals & Non-Goals (Phase 1)

**Goals**
- One recursive `thesis_nodes` table replacing `chapters` + `sections`.
- Safe, **reversible** migration of existing theses (no data loss).
- Server CRUD: MCP tools + REST for create/read/update/delete/move/reorder a node,
  and fetch the whole tree.
- App: render and edit the tree (thesis detail, structure sheet), and update the
  in-app `document-preview` to render the recursive outline.
- Carry `headerText` / `footerText` fields on nodes (data only in Phase 1; consumed
  by Phase 2 export).

**Non-Goals (Phase 1)**
- No DOCX/LaTeX export changes — export keeps working off the *legacy* path until
  Phase 2 (see §6.4).
- No front-matter modelling (cover/abstracts/lists) — Phase 3.
- No rich-text editor rewrite — body stays plain text/markdown as today.

---

## 3. Data Model

### 3.1 New table: `thesis_nodes`

```ts
// modakerati-server/src/db/schema.ts
export const thesisNodes = pgTable("thesis_nodes", {
  id:        uuid("id").primaryKey().defaultRandom(),
  thesisId:  uuid("thesis_id").notNull().references(() => theses.id, { onDelete: "cascade" }),
  parentId:  uuid("parent_id"),            // self-FK; null = top-level (Part). See §3.3.
  depth:     integer("depth").notNull().default(0),       // 0 = Part, 1 = Section, …
  orderIndex:integer("order_index").notNull().default(0), // order among SIBLINGS
  title:     text("title").notNull(),
  body:      text("body").default(""),     // prose for this node (markdown/plain)
  // Export metadata (Phase 2 consumes these). Optional per node.
  headerText:text("header_text"),          // running header; null → derive from title
  footerText:text("footer_text"),          // footer line; supports {page}, {title} tokens
  kind:      text("kind"),                 // optional label override; null → derive from depth
  status:    text("status").default("not_started"),       // not_started|in_progress|done
  wordCount: integer("word_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

Indexes: `(thesis_id, parent_id, order_index)` for sibling-ordered tree reads.

### 3.2 Depth → label mapping

`depth` is the source of truth for a node's role; `kind` is an optional override.

| depth | default label (en / ar) | export heading style (Phase 2) |
|---|---|---|
| 0 | Part / الباب | `Titre1` (outline 0) |
| 1 | Section / القسم | `Titre2` (outline 1) |
| 2 | Chapter / الفصل | `Titre3` (outline 2) |
| 3 | Subtitle / عنوان فرعي | `Titre4` (outline 3) |
| 4+ | Subtitle (deeper) | `Titre4` (clamped; engine defines 1–4) |

> Mapping lives in **one shared helper** (`nodeLabelForDepth(depth, lang)`) used by
> the app UI and, later, the export. Labels are derived, not stored, so re-parenting
> a node relabels it automatically. `kind` exists only for rare manual overrides and
> can be deferred if we want to keep Phase 1 minimal.

### 3.3 `parentId` FK note

Drizzle self-references need the table declared first. We add the FK in a second
step or use `AnyPgColumn`:

```ts
parentId: uuid("parent_id").references((): AnyPgColumn => thesisNodes.id, { onDelete: "cascade" }),
```

`onDelete: cascade` means deleting a node removes its whole subtree — matches the
"delete a Part removes its chapters" expectation. Ownership is still scoped via
`thesis_id → theses.user_id` (same join guards I added for chapters/sections).

### 3.4 Header/footer model (data only in Phase 1)

- Each node *may* set `headerText` and/or `footerText` (single line each).
- Tokens resolved at export time (Phase 2): `{page}` → page number, `{title}` →
  node title, `{year}` → academic year from profile.
- **Default behaviour** (Phase 2): a node with no `headerText` inherits the nearest
  ancestor's header; footer defaults to `{page}`. A node forces a new Word section
  on export when it sets a header/footer **or** is at/above the Chapter level
  (depth ≤ 2) — matching the sample where each الفصل starts a new section.
- Phase 1 just stores and round-trips these fields; no rendering of them yet.

---

## 4. Migration (existing data → tree)

The server uses additive runtime migrations in `ensureSchema()`. This change is a
**table addition + backfill**, kept reversible by *not dropping* the legacy tables.

### 4.1 Steps (idempotent, in `ensureSchema()` or a dedicated `migrateNodes()`)

1. `CREATE TABLE IF NOT EXISTS thesis_nodes (…)` + indexes.
2. **Backfill, once**, guarded by "thesis has no nodes yet":
   - For each chapter (ordered by `order_index`): insert a node `{ depth:0,
     parentId:null, orderIndex:chapter.order_index, title, status }`.
   - For each section under it (ordered): insert a node `{ depth:1,
     parentId:<chapter node id>, orderIndex:section.order_index, title,
     body:section.content, status, wordCount }`.
3. Legacy `chapters` / `sections` tables are **retained** (read-only) for rollback.
   A later cleanup migration (post-Phase 2, once export is proven) drops them.

So existing chapters become **Parts** and their sections become **child Sections** —
lossless, and the student can then nest deeper. (Matches the agreed migration.)

### 4.2 Reversibility

Rollback = point code back at `chapters`/`sections` (still intact) and `DROP TABLE
thesis_nodes`. No destructive step until a separate, explicit cleanup migration.

### 4.3 Word-count / progress

`get_thesis_stats` recomputes from the node tree: `wordCount = Σ node.wordCount`,
`progress = round(doneNodes / leafNodes × 100)` (only count content-bearing leaves),
`pageCount = ceil(words/250)` — same heuristics as today.

---

## 5. Server API

### 5.1 MCP tools (`src/mcp/server.ts`)

Replace the chapter/section tools with node tools (keep names intuitive for the
model). All user-scoped via `thesis_id → user_id` ownership guards.

| Tool | Purpose |
|---|---|
| `get_thesis` | Returns thesis + **nested node tree** (children arrays). |
| `add_node` | `{ thesisId, parentId?, title, body?, headerText?, footerText? }` → inserts as last child of parent (or top-level Part if no parent). Server computes `depth = parent.depth+1` and appends `orderIndex`. |
| `update_node` | Title/body/status/headerText/footerText. |
| `update_node_content` | Body-only (word-count + status side-effects), mirrors today's `update_section_content`. |
| `get_node_content` | Read one node. |
| `delete_node` | Deletes node + subtree (cascade), ownership-checked. |
| `move_node` | Re-parent and/or reorder: `{ nodeId, newParentId?, newIndex? }`. Recomputes `depth` for the moved node **and its descendants**; guards against cycles (can't move a node under itself). |
| `reorder_children` | `{ parentId, orderedChildIds }` — set sibling order. |
| `list_children` | Lightweight (title/depth/status/wordCount, no body). |
| `search_thesis` | Unchanged in spirit; searches node titles + bodies. |

`export_thesis`, references, notify, profile tools unchanged in Phase 1 (export uses
legacy path — §6.4).

### 5.2 REST (`src/routes/thesis.ts`)

- `GET /api/thesis/:id` → `{ ...thesis, nodes: <nested tree> }` (ownership-scoped).
- `POST/PUT/DELETE /api/thesis/:id/nodes…` mirror the MCP CRUD for the app.
- The legacy `chapters`/`sections` response shape is dropped from this route once
  the app is migrated (§6).

### 5.3 Tree build helper

One server helper `loadNodeTree(thesisId)` selects all nodes for a thesis ordered by
`(depth, parentId, orderIndex)` and assembles the nested structure in memory (single
query, O(n) assembly) — used by `get_thesis`, REST, and the stats tool.

---

## 6. App (`~/modakerati`)

### 6.1 Types & store

- `types/thesis.ts`: `ThesisNode { id, parentId, depth, orderIndex, title, body,
  headerText?, footerText?, status, children: ThesisNode[] }`.
- `stores/thesis-store.ts`: replace `chapters[].sections[]` with `nodes` (tree or a
  flat map + selectors). Add tree mutators: `addNode`, `updateNode`, `deleteNode`,
  `moveNode`, `reorderChildren` (optimistic, reconciled from server).

### 6.2 Tree UI

- **Thesis detail** ([app/(app)/…] / the screen in the first screenshot): render the
  outline as an indented, collapsible tree. Each row shows the derived label
  (`nodeLabelForDepth`), title, child count, status dot. Add-child / add-sibling /
  indent / outdent / delete actions. Depth shown by indentation.
- **ThesisStructureSheet**: same tree, compact, with drag-to-reorder (reuses
  `reorderChildren` / `moveNode`).
- A small shared `nodeLabelForDepth(depth, lang)` (en/fr/ar) in `lib/`.

### 6.3 Document preview (recursive)

Update `app/(app)/document-preview.tsx` (already rendering real thesis content) to
**walk the node tree recursively**: render each node's heading at a font-size scaled
by depth + its body paragraphs, indented by depth, in document order (DFS). RTL per
node text (already handled). The "page" indicator tracks top-level nodes (Parts).

### 6.4 Export during Phase 1

Export (`thesis-export.ts` / `docx.ts` / `latex.ts`) currently reads
`chapters→sections`. To avoid blocking Phase 1 on the full Phase 2 export rewrite,
`loadThesisTree()` gets a **thin compatibility shim**: it flattens the node tree to
the old `{ chapters:[{ sections:[] }] }` shape (depth-0 = chapter, everything deeper
folded into that chapter's sections, with heading prefixes). Output is correct but
flat. Phase 2 replaces this with true section/heading/header/footer mapping.

---

## 7. Verification

- **Server**: `npx tsc --noEmit` clean. A `scripts/` test that (a) creates a thesis,
  (b) runs the backfill, (c) asserts chapters→Parts / sections→children with order
  preserved, (d) exercises add/move/delete/reorder + cycle-guard, (e) confirms
  legacy tables untouched. (Runs against the real DB locally; sandbox can't reach
  Supabase over HTTPS but Postgres pooler works.)
- **App**: `npx tsc --noEmit --ignoreDeprecations 6.0` clean for changed files; the
  7 pre-existing errors (`_layout.tsx`, `ProviderSelector.tsx`) stay out of scope.
- **Manual**: open a migrated thesis → see Parts/Sections; add a deep subtitle;
  reorder; preview renders the nested outline.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Big-bang replace of chapters/sections breaks existing MCP/REST/app code | Retain legacy tables; migrate readers incrementally; compat shim for export (§6.4). |
| `move_node` creating cycles or wrong depths | Server validates target ∉ subtree(node); recompute depth for moved subtree in one pass. |
| Deep trees → heavy reads | Single ordered query + in-memory assembly; `list_children` for lightweight nav. |
| App store refactor ripples widely (structure sheet, preview, editors) | Phase 1 keeps body editing as-is (plain text); only the *shape* changes (tree vs 2-level). |
| Export regression | Export untouched logically — compat shim preserves current output until Phase 2. |

---

## 9. Open Questions

1. **Depth→label defaults** — confirm Part(0) / Section(1) / Chapter(2) / Subtitle(3+)
   as the display labels (matches "parts → sections → chapters"). Alternative the
   sample suggests: Part(0) / Chapter(1) / Subtitle(2+), with "section" reserved for
   the generic Word-section concept. The data model supports either — this only sets
   default display strings.
2. **`kind` override** — keep the optional manual label override in Phase 1, or defer
   to depth-only and add `kind` in Phase 2? (Leaning: defer; depth-only is simpler.)
2. **Legacy table drop** — confirm we drop `chapters`/`sections` only in a post-Phase-2
   cleanup migration, not in Phase 1.
3. **Max depth guard** — cap UI nesting (e.g. 6) to stay within Word's heading levels,
   or allow unlimited and clamp at export? (Leaning: allow unlimited; clamp export.)

---

## 10. Phase Map (for context)

- **Phase 1 (this spec):** data model + migration + CRUD + tree UI + recursive preview.
- **Phase 2:** map the node tree → mdocxengine — `Titre{depth+1}` headings, per-section
  `sectPr` with header/footer parts, `{page}/{title}/{year}` tokens, abjad-vs-decimal
  page numbering, auto-TOC (`headingDepth: 4`). Built from a base thesis template.
- **Phase 3:** front matter (cover, dedication, tri-lingual abstracts, lists of
  tables/figures) + final formatting polish.
