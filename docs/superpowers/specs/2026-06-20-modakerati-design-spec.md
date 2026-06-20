# Modakerati (مذكرتي) — Design Specification

> AI-powered thesis builder for Algerian university students.
> Chat with AI to create, edit, and enhance graduation theses — exported as .docx, PDF, or LaTeX.

---

## 1. Product Overview

### 1.1 What It Is
Modakerati is a mobile app (Android-first, iOS via Expo) where university students build their graduation thesis through an AI chat interface. The student explains each chapter/section to the AI, which generates structured academic content, applies university-specific formatting, and exports production-ready documents.

### 1.2 Target Users
- **Primary:** Algerian university students (final year License L3, Master M2, Doctorat)
- **Secondary:** MENA region students, French-speaking African students
- **Estimated market:** 500,000+ graduating students/year in Algeria alone

### 1.3 Core UX Concept
**Chat-first with floating document manager.** The main screen is an AI conversation. A floating action button (FAB) opens a bottom sheet showing the thesis structure as draggable chapter/section cards. Tapping a section opens a rich text editor for manual refinement.

### 1.4 Languages
- **Trilingual:** Arabic (AR), English (EN), French (FR)
- **Full RTL support** for Arabic — all layouts, navigation, text input must mirror correctly
- **LTR** for English and French
- Language switchable at any time from Settings
- UI language independent from thesis content language

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Mobile App | Expo (React Native) | Cross-platform, native UI |
| UI Framework | NativeWind (Tailwind) + react-native-reusables | Styling + native components |
| Navigation | Expo Router (file-based) | Stack + Tab navigation |
| State | Zustand (global) + React Query (server) | State management |
| Backend API | Hono (Node.js) | AI orchestration, doc processing |
| Document Engine | mdocxengine (custom, this repo) | .docx creation/manipulation |
| Database | Supabase (PostgreSQL) | Users, theses, chapters, sections |
| Auth | Supabase Auth | Email, Google, Apple sign-in |
| Storage | Supabase Storage | Exported files, media, templates |
| Realtime | Supabase Realtime | Cross-device sync |
| Offline | SQLite + PowerSync | Offline draft editing |
| AI | Claude API (primary) + OpenAI (fallback) | Chat, grammar, citations |
| Rich Text | @10play/tentap-editor (Tiptap for RN) | Section editing |
| i18n | i18next + react-i18next | AR/EN/FR translations |
| RTL | React Native I18nManager | Layout mirroring |
| Payments | Chargily + ECCP (DZD) + Stripe (intl) | Subscriptions |
| PDF Export | Puppeteer / LibreOffice (server) | .docx to PDF |
| LaTeX Export | Pandoc (server) | .docx to LaTeX |
| Icons | Lucide React Native | Vector line icons |
| Deploy | Fly.io (Hono) + EAS (Expo) | Server + app deployment |

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│              Expo App (React Native)         │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Chat UI │ │ Editor   │ │ Structure    │  │
│  │         │ │ (Tiptap) │ │ Manager      │  │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘  │
│       │           │              │           │
│  ┌────┴───────────┴──────────────┴────────┐  │
│  │  Zustand Store + React Query Cache     │  │
│  └────┬──────────────────────────┬────────┘  │
│       │                          │           │
│  ┌────┴────────┐  ┌─────────────┴────────┐  │
│  │ Supabase SDK│  │ Hono API Client      │  │
│  │ (Auth, DB,  │  │ (AI, Export, Payment)│  │
│  │  Storage)   │  │                      │  │
│  └────┬────────┘  └──────────┬───────────┘  │
│       │                      │               │
│  ┌────┴────────┐             │               │
│  │ SQLite +    │             │               │
│  │ PowerSync   │             │               │
│  │ (Offline)   │             │               │
│  └─────────────┘             │               │
└──────────────────────────────┼───────────────┘
                               │
                    ┌──────────┴───────────┐
                    │    Hono API Server    │
                    │  ┌────────────────┐   │
                    │  │ JWT Verify     │   │
                    │  │ CORS           │   │
                    │  │ Rate Limiter   │   │
                    │  └────────────────┘   │
                    │                       │
                    │  /api/chat            │
                    │  /api/thesis          │
                    │  /api/export          │
                    │  /api/template        │
                    │  /api/enhance         │
                    │  /api/payment         │
                    │  /api/user            │
                    │                       │
                    │  ┌────────────────┐   │
                    │  │ mdocxengine    │   │
                    │  │ Claude API     │   │
                    │  │ Chargily SDK   │   │
                    │  │ Pandoc / PDF   │   │
                    │  └────────────────┘   │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │     Supabase         │
                    │  PostgreSQL + RLS    │
                    │  Auth + Storage      │
                    │  Realtime            │
                    └──────────────────────┘
```

---

## 4. Database Schema

### 4.1 Tables

```sql
-- Users (extends Supabase auth.users)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  university TEXT,
  department TEXT,
  level TEXT,          -- 'license' | 'master' | 'doctorat'
  academic_year TEXT,
  avatar_url TEXT,
  language TEXT DEFAULT 'fr',   -- 'ar' | 'en' | 'fr'
  theme TEXT DEFAULT 'dark',    -- 'dark' | 'light'
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Theses
theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles NOT NULL,
  title TEXT NOT NULL,
  template_id UUID REFERENCES templates,
  language TEXT DEFAULT 'fr',
  status TEXT DEFAULT 'active',  -- 'active' | 'completed' | 'archived'
  progress INTEGER DEFAULT 0,    -- 0-100
  word_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Chapters
chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  status TEXT DEFAULT 'not_started',  -- 'not_started' | 'in_progress' | 'done'
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Sections
sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',         -- Rich text / HTML content
  order_index INTEGER NOT NULL,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Chat Messages
chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,              -- 'user' | 'assistant'
  content TEXT NOT NULL,
  chapter_id UUID REFERENCES chapters,  -- Context: which chapter
  section_id UUID REFERENCES sections,  -- Context: which section
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Subscriptions
subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles NOT NULL,
  plan TEXT NOT NULL,              -- 'free' | 'pro' | 'pro_plus'
  status TEXT DEFAULT 'active',    -- 'active' | 'expired' | 'cancelled'
  gateway TEXT,                    -- 'chargily' | 'eccp' | 'stripe'
  gateway_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Templates
templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university TEXT NOT NULL,
  type TEXT NOT NULL,               -- 'memoire_master' | 'these_doctorat' | 'pfe' | 'generic'
  language TEXT NOT NULL,           -- 'ar' | 'fr' | 'en' | 'ar/fr'
  name TEXT NOT NULL,
  config JSONB NOT NULL,            -- margins, fonts, spacing, cover format
  chapter_structure JSONB,          -- default chapters for this template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- References / Citations
references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id UUID REFERENCES theses ON DELETE CASCADE NOT NULL,
  author TEXT NOT NULL,
  year TEXT,
  title TEXT NOT NULL,
  source TEXT,                     -- journal, publisher, URL
  citation_style TEXT DEFAULT 'apa',
  cited_chapters TEXT[],           -- array of chapter titles where cited
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Notifications
notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT,                       -- 'ai_complete' | 'export' | 'payment' | 'system'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.2 Row Level Security
- Every table has RLS enabled
- Users can only access their own data: `auth.uid() = user_id`
- Templates are readable by all authenticated users
- Notifications filtered by user_id

---

## 5. App Screens (43 total)

### 5.1 Onboarding & Auth (8 screens)

| # | Screen | Description | Key Components |
|---|---|---|---|
| 00a | Splash Screen | App launch with logo, "Modakerati" + "مذكرتي", loading bar | Brand animation |
| 00 | Intro Slides | 3-step feature walkthrough (Chat, Structure, Export) | Swipeable pages, skip button, dots indicator |
| 01 | Language Picker | Choose AR/EN/FR with radio cards, "Continue" button | Language cards with native names, RTL preview |
| 02 | Login | Email + password, "Forgot password?", social login (Google, Apple), "Sign Up" link | Supabase Auth, vector icons |
| 02a | Signup | Full name, email, university selector, password, confirm password, terms checkbox | University dropdown, password validation |
| 02b | Forgot Password | Email input with lock vector icon, "Send Reset Code" | Single field form |
| 02c | OTP Verification | 6-digit code input boxes, resend timer, mail vector icon | Auto-advance, countdown timer |
| 02d | Reset Password | New password + confirm, strength indicator bar | Password strength meter (weak/medium/strong) |

### 5.2 Home & Templates (9 screens)

| # | Screen | Description | Key Components |
|---|---|---|---|
| 03 | Home | Greeting ("Good morning, Hamza"), quick action grid (New, Import, Templates, AI), recent theses with progress bars, bottom nav | Vector icons, progress bars, avatar |
| 03a | All Theses | Filterable list (All/Active/Completed/Archived), thesis cards with progress %, "+ New" button | Filter chips, percentage badges |
| 03b | Empty State | First-time user — illustration, "No Theses Yet", CTA buttons (Create / Import) | Document vector illustration |
| 06 | Template Picker | Search bar, quick start cards (Blank/AI Wizard/Import), university template list with color accent bars | Magnifier icon, category cards |
| 06a | AI Wizard Step 1 | Topic input, academic field chips (CS, Education, Engineering...), degree level selector (L3/M2/Doctorat) | Step indicator (1/3), chip multi-select |
| 06b | Import .docx Preview | File info card (name, size, pages, words), detected structure list with status badges (Complete/Partial/No refs) | Document icon, status badges |
| 06c | AI Wizard Step 2 | Suggested chapter list with drag handles and numbered badges, "+ Add Chapter" | Drag-to-reorder, numbered list |
| 06d | AI Wizard Step 3 | Summary card (topic, field, level, university, chapters), AI action checklist, estimated time, green "Create" CTA | Review card, checkmarks |
| 06e | Template Preview | Template info (university, type, specs badges), paper-style cover page preview (REPUBLIQUE ALGERIENNE header, university name, thesis title box, year), "Use This Template" green CTA | Cover page rendering |

### 5.3 Chat & Thesis Structure (6 screens)

| # | Screen | Description | Key Components |
|---|---|---|---|
| 04 | Chat | Main AI conversation — AI bubbles (green avatar, dark bg) + user bubbles (primary blue), top bar with thesis title + current chapter, input bar with send arrow, green FAB (thesis structure icon) | Streaming text, context header |
| 04a | AI Generating | Loading state — sparkle animation, "AI is Writing...", progress steps (Analyzing/Researching/Structuring/Writing/Citations with Done labels), progress bar with percentage + time estimate | Step checklist, progress bar |
| 05 | Thesis Structure Modal | Bottom sheet over dimmed chat — handle bar, "Thesis Structure" header + "+ Add" button, status badges (Done/Active/Pending), chapter cards with drag handles, status icons, expandable sections | Drag-reorder, status indicators |
| 05a | Add Chapter/Section | Bottom sheet — type selector (Chapter icon / Section icon), title input, "Insert After" dropdown with chevron, "Let AI draft initial content" toggle, "Create Chapter" CTA | Type toggle, position picker |
| 05b | Edit Chapter | Full screen — status badge, title input, status chips (Not Started/In Progress/Done), sections list with drag handles + word counts + edit icons, AI Actions (Generate all/Suggest missing/Reorder), "Delete Chapter" red button | Status selector, AI actions |
| 05c | Delete Confirmation | Dialog overlay — dimmed background, warning triangle icon, "Delete Chapter?" title, description mentioning section count, Cancel + red Delete buttons | Destructive dialog |

### 5.4 Editor & Preview & Export (11 screens)

| # | Screen | Description | Key Components |
|---|---|---|---|
| 07 | Section Editor | Top bar (Back/Title/Save), breadcrumb (Ch > Section), formatting toolbar (B/I/U/S/H1/H2/P/bullets/numbered/quote/link), rich text content, citation block (blue border), AI suggestion chip (green), word count bar + "AI Enhance" button | Tiptap editor, toolbar |
| 07a | AI Enhance Results | Stats badges (3 Grammar red, 2 Clarity orange, 1 Academic Tone purple), suggestion cards with original (strikethrough) → fixed text, Accept/Dismiss buttons per suggestion, "Apply All" top button | Diff-style cards |
| 07b | Citation Manager | Format selector chips (APA/MLA/Chicago/ISO 690), reference count, reference cards (author, year, italic title, source, "Cited in" badges), "AI: Find more references" suggestion button | Citation format toggle |
| 08 | Document Preview | Paper-style white page in dark viewport, chapter heading + section content, page number, page dots navigation, zoom controls, "Export" button | Paper rendering, pagination |
| 08a | Auto Mise en Page | Template badge showing active university rules, Margins section (Top/Bottom/Left-Binding/Right), Typography section (Body Font/Size/Heading/Line Spacing), Page Setup (Paper Size/Orientation/Header-Footer Height), "Auto-Fix" sparkle button, "Apply Layout" CTA | Settings form, template link |
| 08b | Auto Numbering | Page Numbers section (enable toggle, position, start from, Roman for front matter, Arabic for body), Chapters & Sections (auto chapter/section numbers toggle, hierarchical format), Figures & Tables (auto figure/table/equation numbering toggles), "Apply Numbering" CTA | Toggle groups, format pickers |
| 08c | Auto TOC | Options card (Include Figures List toggle, Include Tables List toggle, Depth selector), Paper-style preview showing formatted TOC (chapters bold, sections indented, page numbers right-aligned), "Refresh" button, "Generate TOC in Document" CTA | Live preview, depth control |
| 08d | List of Figures | Count badge (purple, "8 figures detected across 4 chapters"), paper-style preview (Figure labels bold + captions + page numbers), "Generate Figures List" CTA | Image icon, auto-detection |
| 08e | List of Tables | Count badge (orange, "6 tables detected across 3 chapters"), paper-style preview (Table labels bold + captions + page numbers), "Generate Tables List" CTA | Table icon, auto-detection |
| 09 | Export | Thesis info card (title, chapters, pages, words), format selector (docx selected/PDF/LaTeX with extension badges and radio buttons), options toggles (cover page, TOC, references), "Export as .docx" CTA | Format cards, toggle switches |
| 09a | Export Success | Download circle icon, "Export Complete!", file info (name, size, pages, words), "Share File" primary CTA + "Open in Files" secondary | Success state |

### 5.5 Account & Settings (9 screens)

| # | Screen | Description | Key Components |
|---|---|---|---|
| 10 | Profile | Avatar with border, name, email, Pro badge (shield icon), stats row (3 Theses / 14 Chapters / 8.4K Words), University Information card (4 field rows), action buttons (Edit Profile/Manage Subscription/Help/Log Out with chevrons) | Stats cards, info table |
| 10a | Edit Profile | Cancel/Save top bar, avatar with camera edit badge, "Change Photo" link, form fields (Full Name, Email, University, Department, Level, Academic Year) | Photo upload, form |
| 11 | Subscription | "Upgrade to Pro" header, plan cards — Pro Student (500 DZD/mo, RECOMMENDED badge, 5 features with checkmarks) + Pro+ Researcher (1,500 DZD/mo, gold, 5 features), Payment Methods (CIB/Edahabia/Chargily/Stripe icon cards), "Subscribe" CTA | Plan comparison, payment icons |
| 11a | Payment Checkout | Order summary card (plan, duration, price), payment method radio (CIB/Edahabia), card form (number, expiry, CVV), "Pay 500 DZD" CTA, "Secured by Chargily" footer | Card input, method selector |
| 11b | Payment Success | Green check circle, "Payment Successful!", receipt card (Plan, Amount, Method, Date), "Start Building Your Thesis" CTA | Success animation |
| 11c | Payment Failed | Red X circle, "Payment Failed", error description, error code badge ("Insufficient funds CIB-4023"), "Try Again" + "Use Different Payment Method" buttons | Error state |
| 12 | Settings | Sections: GENERAL (Language globe/Theme moon/AI Model cpu), NOTIFICATIONS (Push bell/AI Suggestions sparkle/Export Reminders clock — toggles), DATA & PRIVACY (Cloud Sync cloud/Offline Storage server/Clear Cache trash/Delete Account warning), ABOUT (Version info/Terms doc/Privacy shield) | Grouped settings, vector icons |
| 13 | Notifications | Notification cards with colored dots (green/blue/orange/purple), title + description + timestamp, unread cards have card background + border, read cards flat | Unread indicators |
| 14 | Network Error | Orange wifi-off icon, "No Connection", description, "Available offline" card (3 features with checkmarks), "Retry Connection" CTA + "Continue in Offline Mode" link | Offline features list |

---

## 6. Internationalization (i18n) & RTL

### 6.1 Supported Languages
| Code | Language | Direction | Script |
|---|---|---|---|
| `ar` | Arabic (العربية) | RTL | Arabic |
| `en` | English | LTR | Latin |
| `fr` | French (Francais) | LTR | Latin |

### 6.2 RTL Implementation Requirements
- **Layout mirroring:** All horizontal layouts flip in RTL (back arrow becomes forward arrow on right, FAB moves to left, text aligns right)
- **Navigation:** Tab bar order mirrors, stack navigation back gesture flips
- **Icons:** Directional icons (arrows, chevrons) must flip. Non-directional icons (search, settings) do NOT flip
- **Text input:** Arabic text input uses right-aligned placeholder and cursor
- **Numbers:** Page numbers, word counts, prices remain LTR even in Arabic UI (standard practice)
- **Mixed content:** A thesis in French with Arabic UI — content stays LTR, UI stays RTL
- **NativeWind:** Use `start`/`end` instead of `left`/`right` for padding/margin (e.g., `ps-4` not `pl-4`)
- **I18nManager.forceRTL(true):** Called on language switch, requires app restart

### 6.3 Translation Structure
```
locales/
  ar.json    — Arabic translations
  en.json    — English translations
  fr.json    — French translations
```

Each file mirrors the same key structure:
```json
{
  "common": { "continue": "...", "cancel": "...", "save": "...", "delete": "..." },
  "auth": { "login": "...", "signup": "...", "forgotPassword": "..." },
  "home": { "greeting": "...", "recentTheses": "...", "newThesis": "..." },
  "chat": { "placeholder": "...", "aiGenerating": "..." },
  "thesis": { "chapters": "...", "sections": "...", "addChapter": "..." },
  "editor": { "wordCount": "...", "aiEnhance": "..." },
  "export": { "chooseFormat": "...", "exportSuccess": "..." },
  "settings": { "language": "...", "theme": "...", "notifications": "..." },
  "payment": { "subscribe": "...", "paymentSuccess": "...", "paymentFailed": "..." }
}
```

### 6.4 Font Requirements
- **Arabic:** Use system Arabic font (on Android: Noto Sans Arabic, on iOS: SF Arabic)
- **Latin (EN/FR):** Inter (loaded from Google Fonts or bundled)
- Body text in Arabic typically uses 14-16pt (slightly larger than Latin for readability)

---

## 7. Design System

### 7.1 Colors (Dark / Light)
| Token | Dark | Light |
|---|---|---|
| bg/primary | #121220 | #FAFAFE |
| bg/surface | #232338 | #F0F0F5 |
| bg/card | #1C1C2E | #FFFFFF |
| bg/modal | #171726 | #F8F8FA |
| bg/input | #1A1A28 | #F2F2F7 |
| text/primary | #FFFFFF | #1A1A26 |
| text/secondary | #9999AE | #737385 |
| text/placeholder | #666678 | #A6A6B3 |
| brand/primary | #5C6BFF | #4D5CEB |
| brand/accent | #33D6A6 | #26B88C |
| semantic/success | #33D6A6 | #26B88C |
| semantic/warning | #FF9933 | #E69919 |
| semantic/error | #FF5959 | #E64040 |
| chat/ai-bubble | #1E2138 | #EDEEF8 |
| chat/user-bubble | #5C6BFF | #4D5CEB |

### 7.2 Typography
| Style | Font | Weight | Size |
|---|---|---|---|
| Heading 1 | Inter | Bold (700) | 24px |
| Heading 2 | Inter | Bold (700) | 20px |
| Heading 3 | Inter | Semi Bold (600) | 18px |
| Body | Inter | Regular (400) | 15px |
| Body Small | Inter | Regular (400) | 13px |
| Caption | Inter | Medium (500) | 11px |
| Button | Inter | Semi Bold (600) | 16px |
| Label | Inter | Medium (500) | 13px |

### 7.3 Spacing & Radius
| Token | Value |
|---|---|
| Screen padding | 20-32px |
| Card padding | 14-18px |
| Item gap | 12-16px |
| Section gap | 20-24px |
| radius/sm | 8px |
| radius/md | 12px |
| radius/lg | 14px |
| radius/xl | 16px |
| radius/full | 100px (pills) |

### 7.4 Icons
- **Library:** Lucide React Native (line style)
- **Size:** 20x20px default, 24x24px for nav, 14-16px inline
- **Stroke:** 1.8-2px weight, round cap/join
- **Rule:** Vector icons only — NO emojis in UI elements
- **RTL:** Directional icons (arrow-left, chevron-right) auto-flip; symmetric icons (search, settings, bell) do not

### 7.5 Components (shared across screens)
- **PrimaryButton** — full width, 14px radius, 54px height, primary fill
- **SecondaryButton** — full width, 14px radius, surface fill
- **TextInput** — 12px radius, inputBg fill, surface stroke, 50px height
- **Card** — 14-16px radius, cardBg fill, optional colored border
- **BottomSheet** — 24px top radius, modal bg, handle bar
- **StatusBadge** — 6px radius, colored bg opacity 0.12, colored text
- **Toggle** — 44x24px, rounded, knob animation
- **NavBar** — cardBg fill, 4 icon+label items, active = primary color

---

## 8. API Routes (Hono)

### 8.1 Authentication Middleware
All routes except `/api/health` require valid Supabase JWT in `Authorization: Bearer <token>` header. Middleware verifies token and attaches `user_id` to context.

### 8.2 Routes

```
POST   /api/chat/send           — Send message, get AI stream response
GET    /api/chat/:thesisId      — Get chat history for thesis

GET    /api/thesis               — List user's theses
POST   /api/thesis               — Create thesis (from template, wizard, or blank)
GET    /api/thesis/:id           — Get thesis with chapters + sections
PUT    /api/thesis/:id           — Update thesis metadata
DELETE /api/thesis/:id           — Delete thesis

POST   /api/thesis/:id/chapters            — Add chapter
PUT    /api/thesis/:id/chapters/:chapterId — Update chapter
DELETE /api/thesis/:id/chapters/:chapterId — Delete chapter
PUT    /api/thesis/:id/chapters/reorder    — Reorder chapters

POST   /api/thesis/:id/chapters/:chapterId/sections            — Add section
PUT    /api/thesis/:id/chapters/:chapterId/sections/:sectionId — Update section
DELETE /api/thesis/:id/chapters/:chapterId/sections/:sectionId — Delete section

POST   /api/export/:thesisId     — Export thesis (body: { format: 'docx' | 'pdf' | 'latex', options })
GET    /api/export/:exportId     — Download exported file

GET    /api/templates            — List available templates
GET    /api/templates/:id        — Get template details + preview config

POST   /api/enhance/grammar      — Grammar check (body: { text, language })
POST   /api/enhance/paraphrase   — Paraphrase text
POST   /api/enhance/citations    — Generate citations for text

POST   /api/payment/checkout     — Create Chargily/ECCP checkout session
POST   /api/payment/webhook      — Chargily/ECCP webhook handler
GET    /api/payment/subscription — Get current subscription status

GET    /api/user/profile         — Get profile
PUT    /api/user/profile         — Update profile
GET    /api/user/notifications   — Get notifications
PUT    /api/user/notifications/:id/read — Mark as read

POST   /api/thesis/:id/toc       — Generate table of contents
POST   /api/thesis/:id/figures   — Generate list of figures
POST   /api/thesis/:id/tables    — Generate list of tables
POST   /api/thesis/:id/format    — Apply auto mise en page
POST   /api/thesis/:id/numbering — Apply auto numbering
POST   /api/thesis/:id/import    — Import .docx and parse structure

GET    /api/references/:thesisId — List references
POST   /api/references/:thesisId — Add reference
PUT    /api/references/:id       — Update reference
DELETE /api/references/:id       — Delete reference
```

---

## 9. Monetization

### 9.1 Plans

| Feature | Free | Pro Student (500 DZD/mo) | Pro+ Researcher (1,500 DZD/mo) |
|---|---|---|---|
| AI Chat messages | 20/day | Unlimited | Unlimited + priority |
| Active theses | 1 | 3 | Unlimited |
| Templates | 3 basic | All | All + custom |
| Export formats | .docx only | .docx + PDF | .docx + PDF + LaTeX |
| Auto-formatting | Basic | Full university rules | Full + custom rules |
| Citation manager | Manual only | AI-assisted | AI + auto-detect |
| Grammar/Paraphrase | 5 checks/day | Unlimited | Unlimited + tone control |
| Cloud storage | 100 MB | 1 GB | 5 GB |
| Auto TOC/Numbering | Manual | Auto-generate | Auto + List of Figures/Tables |

### 9.2 Payment Gateways
- **Chargily:** CIB + Edahabia cards (primary for Algeria)
- **ECCP:** Additional Algerian bank card processing
- **Stripe:** International cards for MENA expansion (USD/EUR)

---

## 10. Offline Strategy

### 10.1 What Works Offline
- Read & edit saved sections (cached in SQLite)
- View thesis structure
- Access cached templates
- Draft new content (queued for sync)

### 10.2 What Requires Internet
- AI chat and content generation
- Export to PDF/LaTeX (server-side processing)
- Payment processing
- Cloud sync and backup
- Template downloads

### 10.3 Sync Strategy
- PowerSync watches SQLite changes
- On reconnect: push local changes to Supabase, pull remote changes
- Conflict resolution: last-write-wins with timestamp comparison
- Network status indicator in UI (Screen 14)

---

## 11. Figma Design Reference

- **File:** https://www.figma.com/design/V4MtAu1PzvAU8rxbzbAVDd
- **Pages:** App Screens (43 screens in 5 sections + Light Mode), System Architecture (5-layer diagram)
- **Theme Variables:** 28 tokens in "Theme" collection (Dark + Light modes)
- **Design conventions:** 390x844 screen size, Inter font, Lucide vector icons, 12-16px radius
