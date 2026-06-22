# Modakerati Phase 4: Editor & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the section editor with rich text toolbar, document preview, export screen with format selection, auto mise en page, auto numbering, auto TOC, list of figures/tables, citation manager, and AI enhance results screen.

**Architecture:** Tiptap-based editor via @10play/tentap-editor for rich text editing. Document preview renders thesis content in paper-style layout. Export triggers mdocxengine on the Hono backend (stubbed locally for now). Auto-formatting screens manage thesis layout rules from templates.

**Tech Stack:** Existing stack + @10play/tentap-editor for rich text

---

## Task 1: Section Editor Screen

Build the rich text section editor (Figma screen 07):
- Top bar: Back + "Section Editor" + Save (green)
- Breadcrumb: Ch > Section name
- Formatting toolbar: B, I, U, S, H1, H2, bullets, numbered, quote, link
- Rich text content area with thesis content
- AI suggestion chip at bottom
- Word count bar + "AI Enhance" button

**Files:**
- Replace: `~/modakerati/app/(app)/section-editor.tsx` (new)
- Update: `~/modakerati/app/(app)/_layout.tsx` (add route)

---

## Task 2: Document Preview + Export

Build document preview (screen 08) and export (screen 09) screens:
- Preview: paper-style white page in dark viewport, chapter/section content, page number, zoom controls
- Export: thesis info card, format selector (docx/pdf/latex), options toggles, export button
- Export Success: confirmation with file info, share/open buttons

**Files:**
- Create: `~/modakerati/app/(app)/document-preview.tsx`
- Create: `~/modakerati/app/(app)/export.tsx`
- Create: `~/modakerati/app/(app)/export-success.tsx`

---

## Task 3: Auto Formatting Screens

Build auto mise en page (08a), auto numbering (08b), auto TOC (08c), list of figures (08d), list of tables (08e):
- Settings screens with toggles and value rows
- Paper-style previews for TOC/figures/tables

**Files:**
- Create: `~/modakerati/app/(app)/auto-layout.tsx`
- Create: `~/modakerati/app/(app)/auto-numbering.tsx`
- Create: `~/modakerati/app/(app)/auto-toc.tsx`
- Create: `~/modakerati/app/(app)/list-figures.tsx`
- Create: `~/modakerati/app/(app)/list-tables.tsx`

---

## Task 4: Citation Manager + AI Enhance

Build citation manager (07b) and AI enhance results (07a):
- Citations: format selector, reference cards, AI suggest button
- AI Enhance: stats badges, suggestion cards with original/fixed, accept/dismiss

**Files:**
- Create: `~/modakerati/app/(app)/citations.tsx`
- Create: `~/modakerati/app/(app)/ai-enhance.tsx`

---

## Task 5: i18n Keys + Verification

Add all editor/export/format i18n keys, verify TypeScript, commit.

---
