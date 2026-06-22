# Modakerati Phase 2: Thesis Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the thesis management features — Home screen with real content, All Theses list, Empty State, Template Picker with preview, AI Wizard (3 steps), thesis structure modal with chapter/section CRUD.

**Architecture:** Zustand stores for thesis state, Supabase queries via React Query, reusable thesis card components. All screens use existing theme/i18n from Phase 1.

**Tech Stack:** Existing Phase 1 stack + react-native-draggable-flatlist for reorder, expo-document-picker for .docx import

---

## Task 1: Thesis Zustand Store + Types

**Files:**
- Create: `~/modakerati/types/thesis.ts`
- Create: `~/modakerati/stores/thesis-store.ts`
- Modify: `~/modakerati/stores/index.ts`

Create thesis types and a Zustand store with local state for MVP (Supabase integration in later phase). Store manages theses, chapters, sections with CRUD operations.

### ~/modakerati/types/thesis.ts
```ts
export type ThesisStatus = "active" | "completed" | "archived";
export type ChapterStatus = "not_started" | "in_progress" | "done";

export interface Section {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  orderIndex: number;
  wordCount: number;
  status: ChapterStatus;
}

export interface Chapter {
  id: string;
  thesisId: string;
  title: string;
  orderIndex: number;
  status: ChapterStatus;
  sections: Section[];
}

export interface Thesis {
  id: string;
  title: string;
  templateId?: string;
  language: string;
  status: ThesisStatus;
  progress: number;
  wordCount: number;
  pageCount: number;
  chapters: Chapter[];
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  university: string;
  type: string;
  language: string;
  name: string;
  config: {
    margins: { top: string; bottom: string; left: string; right: string };
    bodyFont: string;
    bodySize: string;
    headingFont: string;
    lineSpacing: string;
    paperSize: string;
  };
  chapterStructure: string[];
}
```

### ~/modakerati/stores/thesis-store.ts
```ts
import { create } from "zustand";
import type { Thesis, Chapter, Section, Template } from "@/types/thesis";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface ThesisState {
  theses: Thesis[];
  currentThesisId: string | null;
  templates: Template[];

  // Thesis CRUD
  createThesis: (title: string, templateId?: string, chapters?: string[]) => string;
  deleteThesis: (id: string) => void;
  updateThesis: (id: string, updates: Partial<Thesis>) => void;
  setCurrentThesis: (id: string | null) => void;
  getCurrentThesis: () => Thesis | null;

  // Chapter CRUD
  addChapter: (thesisId: string, title: string, afterIndex?: number) => void;
  updateChapter: (thesisId: string, chapterId: string, updates: Partial<Chapter>) => void;
  deleteChapter: (thesisId: string, chapterId: string) => void;
  reorderChapters: (thesisId: string, chapters: Chapter[]) => void;

  // Section CRUD
  addSection: (thesisId: string, chapterId: string, title: string) => void;
  updateSection: (thesisId: string, chapterId: string, sectionId: string, updates: Partial<Section>) => void;
  deleteSection: (thesisId: string, chapterId: string, sectionId: string) => void;

  // Templates
  loadTemplates: () => void;
}

const SAMPLE_TEMPLATES: Template[] = [
  {
    id: "t1",
    university: "Universite de Djelfa",
    type: "memoire_master",
    language: "ar/fr",
    name: "Memoire de Master",
    config: {
      margins: { top: "2.5 cm", bottom: "2.5 cm", left: "3.0 cm", right: "2.0 cm" },
      bodyFont: "Times New Roman", bodySize: "12 pt",
      headingFont: "Times New Roman Bold", lineSpacing: "1.5", paperSize: "A4",
    },
    chapterStructure: ["Cover Page", "Introduction", "Literature Review", "Methodology", "Results & Discussion", "Conclusion", "References", "Appendices"],
  },
  {
    id: "t2",
    university: "USTHB Alger",
    type: "these_doctorat",
    language: "fr",
    name: "These de Doctorat",
    config: {
      margins: { top: "2.5 cm", bottom: "2.5 cm", left: "3.0 cm", right: "2.0 cm" },
      bodyFont: "Times New Roman", bodySize: "12 pt",
      headingFont: "Times New Roman Bold", lineSpacing: "1.5", paperSize: "A4",
    },
    chapterStructure: ["Cover Page", "Abstract", "Introduction", "State of the Art", "Contribution", "Experiments", "Conclusion", "References"],
  },
  {
    id: "t3",
    university: "Universite de Blida",
    type: "memoire_licence",
    language: "ar/fr",
    name: "Memoire de Licence",
    config: {
      margins: { top: "2.5 cm", bottom: "2.5 cm", left: "2.5 cm", right: "2.5 cm" },
      bodyFont: "Times New Roman", bodySize: "12 pt",
      headingFont: "Arial Bold", lineSpacing: "1.5", paperSize: "A4",
    },
    chapterStructure: ["Cover Page", "Introduction", "Chapter 1", "Chapter 2", "Chapter 3", "Conclusion", "References"],
  },
  {
    id: "t4",
    university: "ESI Alger",
    type: "pfe",
    language: "fr/en",
    name: "PFE - Projet de Fin d'Etudes",
    config: {
      margins: { top: "2.5 cm", bottom: "2.5 cm", left: "3.0 cm", right: "2.0 cm" },
      bodyFont: "Times New Roman", bodySize: "12 pt",
      headingFont: "Arial Bold", lineSpacing: "1.5", paperSize: "A4",
    },
    chapterStructure: ["Cover Page", "Acknowledgements", "Introduction", "State of the Art", "Analysis & Design", "Implementation", "Conclusion", "References"],
  },
  {
    id: "t5",
    university: "Generic International",
    type: "generic",
    language: "en",
    name: "Master's Thesis",
    config: {
      margins: { top: "1 in", bottom: "1 in", left: "1.5 in", right: "1 in" },
      bodyFont: "Times New Roman", bodySize: "12 pt",
      headingFont: "Times New Roman Bold", lineSpacing: "2.0", paperSize: "Letter",
    },
    chapterStructure: ["Title Page", "Abstract", "Introduction", "Literature Review", "Methodology", "Results", "Discussion", "Conclusion", "References"],
  },
];

export const useThesisStore = create<ThesisState>((set, get) => ({
  theses: [],
  currentThesisId: null,
  templates: [],

  createThesis: (title, templateId, chapters) => {
    const id = generateId();
    const chapterList = (chapters ?? ["Introduction", "Chapter 1", "Conclusion"]).map(
      (ch, i) => ({
        id: generateId(),
        thesisId: id,
        title: ch,
        orderIndex: i,
        status: "not_started" as const,
        sections: [],
      })
    );
    const thesis: Thesis = {
      id, title, templateId, language: "fr", status: "active",
      progress: 0, wordCount: 0, pageCount: 0,
      chapters: chapterList,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ theses: [...s.theses, thesis] }));
    return id;
  },

  deleteThesis: (id) => set((s) => ({ theses: s.theses.filter((t) => t.id !== id) })),

  updateThesis: (id, updates) =>
    set((s) => ({
      theses: s.theses.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)),
    })),

  setCurrentThesis: (id) => set({ currentThesisId: id }),

  getCurrentThesis: () => {
    const { theses, currentThesisId } = get();
    return theses.find((t) => t.id === currentThesisId) ?? null;
  },

  addChapter: (thesisId, title, afterIndex) =>
    set((s) => ({
      theses: s.theses.map((t) => {
        if (t.id !== thesisId) return t;
        const idx = afterIndex !== undefined ? afterIndex + 1 : t.chapters.length;
        const newChapter: Chapter = {
          id: generateId(), thesisId, title, orderIndex: idx,
          status: "not_started", sections: [],
        };
        const chapters = [...t.chapters];
        chapters.splice(idx, 0, newChapter);
        return { ...t, chapters: chapters.map((ch, i) => ({ ...ch, orderIndex: i })) };
      }),
    })),

  updateChapter: (thesisId, chapterId, updates) =>
    set((s) => ({
      theses: s.theses.map((t) =>
        t.id === thesisId
          ? { ...t, chapters: t.chapters.map((ch) => (ch.id === chapterId ? { ...ch, ...updates } : ch)) }
          : t
      ),
    })),

  deleteChapter: (thesisId, chapterId) =>
    set((s) => ({
      theses: s.theses.map((t) =>
        t.id === thesisId
          ? { ...t, chapters: t.chapters.filter((ch) => ch.id !== chapterId).map((ch, i) => ({ ...ch, orderIndex: i })) }
          : t
      ),
    })),

  reorderChapters: (thesisId, chapters) =>
    set((s) => ({
      theses: s.theses.map((t) =>
        t.id === thesisId ? { ...t, chapters: chapters.map((ch, i) => ({ ...ch, orderIndex: i })) } : t
      ),
    })),

  addSection: (thesisId, chapterId, title) =>
    set((s) => ({
      theses: s.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              chapters: t.chapters.map((ch) =>
                ch.id === chapterId
                  ? {
                      ...ch,
                      sections: [
                        ...ch.sections,
                        { id: generateId(), chapterId, title, content: "", orderIndex: ch.sections.length, wordCount: 0, status: "not_started" as const },
                      ],
                    }
                  : ch
              ),
            }
          : t
      ),
    })),

  updateSection: (thesisId, chapterId, sectionId, updates) =>
    set((s) => ({
      theses: s.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              chapters: t.chapters.map((ch) =>
                ch.id === chapterId
                  ? { ...ch, sections: ch.sections.map((sec) => (sec.id === sectionId ? { ...sec, ...updates } : sec)) }
                  : ch
              ),
            }
          : t
      ),
    })),

  deleteSection: (thesisId, chapterId, sectionId) =>
    set((s) => ({
      theses: s.theses.map((t) =>
        t.id === thesisId
          ? {
              ...t,
              chapters: t.chapters.map((ch) =>
                ch.id === chapterId
                  ? { ...ch, sections: ch.sections.filter((sec) => sec.id !== sectionId).map((sec, i) => ({ ...sec, orderIndex: i })) }
                  : ch
              ),
            }
          : t
      ),
    })),

  loadTemplates: () => set({ templates: SAMPLE_TEMPLATES }),
}));
```

Update `~/modakerati/stores/index.ts`:
```ts
export { useAuthStore } from "./auth-store";
export { useSettingsStore } from "./settings-store";
export { useThesisStore } from "./thesis-store";
```

---

## Task 2: Home Screen (Real Content)

Replace the placeholder `~/modakerati/app/(tabs)/index.tsx` with the full Home screen matching Figma screen 03:
- Greeting with user name
- Quick action grid (4 cards: New Thesis, Import, Templates, AI Assist) with vector icons from lucide
- "Recent Theses" section with thesis cards showing title, chapter count, date, progress bar
- Empty state when no theses
- Uses useThesisStore, useThemeColors, useTranslation

---

## Task 3: Template Picker + Preview

Replace `~/modakerati/app/(tabs)/thesis.tsx` to serve as the "All Theses" screen. Create new screens:
- `~/modakerati/app/(app)/template-picker.tsx` — Template list with search, quick start cards (Blank/AI Wizard/Import), university template cards with color accent bars
- `~/modakerati/app/(app)/template-preview.tsx` — Template info card, specs badges, paper-style cover page preview, "Use This Template" CTA

---

## Task 4: Thesis Structure Modal + Chapter CRUD

Create:
- `~/modakerati/components/ThesisStructureModal.tsx` — Bottom sheet with chapter cards, drag handles, status indicators, "+ Add" button
- `~/modakerati/components/AddChapterSheet.tsx` — Bottom sheet for adding chapter/section with type selector
- `~/modakerati/app/(app)/edit-chapter.tsx` — Edit chapter screen with title, status, sections list, AI actions, delete

---

## Task 5: Verification + Commit

Verify all screens render, navigation works, thesis CRUD operations function, and commit.

---
