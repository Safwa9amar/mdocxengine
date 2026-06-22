# Modakerati Phase 3: Chat & AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the chat UI with AI conversation, thesis structure bottom sheet modal with FAB, AI generating loading state, and chapter/section context management.

**Architecture:** Chat screen with message list + input bar + floating FAB. Messages stored in Zustand. AI responses via Hono backend (stubbed for now with simulated responses). Bottom sheet modal for thesis structure management.

**Tech Stack:** Existing stack + @gorhom/bottom-sheet for modals

---

## Task 1: Chat Store + Message Types

Create chat message types and Zustand store for managing conversation state per thesis.

**Files:**
- Create: `~/modakerati/types/chat.ts`
- Create: `~/modakerati/stores/chat-store.ts`
- Update: `~/modakerati/stores/index.ts`

---

## Task 2: Chat Screen UI

Build the main chat screen matching Figma screen 04:
- Top bar: back arrow, thesis title + current chapter subtitle, menu dots
- Message list: AI bubbles (green dot avatar, dark bg, left-aligned) + user bubbles (primary blue, right-aligned)
- Input bar: rounded pill input + send button (paper plane icon)
- Green FAB (bottom right) that opens the thesis structure modal

**Files:**
- Replace: `~/modakerati/app/(tabs)/chat.tsx`

---

## Task 3: Thesis Structure Bottom Sheet

Build the bottom sheet modal (Figma screen 05) that opens when FAB is tapped:
- Handle bar + "Thesis Structure" header + "+ Add" button
- Status summary badges (Done / Active / Pending)
- Chapter cards with drag handle dots, title, status icon, expandable sections
- Tapping a chapter navigates to edit-chapter screen

**Files:**
- Create: `~/modakerati/components/ThesisStructureSheet.tsx`

---

## Task 4: AI Generating State

Build the AI generating loading screen (Figma screen 04a):
- Sparkle icon animation area
- "AI is Writing..." title + section name
- Progress steps checklist (Analyzing/Researching/Structuring/Writing/Citations)
- Progress bar with percentage + time estimate

**Files:**
- Create: `~/modakerati/components/AIGeneratingOverlay.tsx`

---

## Task 5: Simulated AI Responses + Integration

Create a simulated AI response service that generates fake responses with typing delay, integrate with chat screen. Wire up FAB → bottom sheet → chapter navigation.

**Files:**
- Create: `~/modakerati/lib/ai-service.ts`
- Modify: chat screen to use simulated responses

---

## Task 6: Chat i18n Keys + Verification

Add all chat-related i18n keys to all 3 locales, verify TypeScript compiles, commit.

---
