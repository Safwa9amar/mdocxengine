# Modakerati Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Modakerati Expo app with Supabase auth, trilingual i18n (AR/EN/FR) with full RTL support, dark/light theme system, tab navigation with floating navbar, and core screen shells.

**Architecture:** Expo Router file-based navigation with NativeWind styling. Supabase handles auth (email, Google, Apple). i18next manages translations with I18nManager for RTL. Zustand stores theme/language preferences. All screens are shells matching the 43-screen Figma design.

**Tech Stack:** Expo SDK 53, Expo Router, NativeWind v4, Supabase JS, i18next, react-i18next, Zustand, Lucide React Native, react-native-reusables

**Design Reference:** https://www.figma.com/design/V4MtAu1PzvAU8rxbzbAVDd

---

## File Structure

```
modakerati/
├── app/
│   ├── _layout.tsx                  — Root layout (providers, fonts, splash)
│   ├── (auth)/
│   │   ├── _layout.tsx              — Auth stack layout
│   │   ├── onboarding.tsx           — Intro slides (screen 00)
│   │   ├── language.tsx             — Language picker (screen 01)
│   │   ├── login.tsx                — Login (screen 02)
│   │   ├── signup.tsx               — Signup (screen 02a)
│   │   ├── forgot-password.tsx      — Forgot password (screen 02b)
│   │   ├── otp.tsx                  — OTP verification (screen 02c)
│   │   └── reset-password.tsx       — Reset password (screen 02d)
│   ├── (tabs)/
│   │   ├── _layout.tsx              — Tab layout with floating navbar
│   │   ├── index.tsx                — Home (screen 03)
│   │   ├── chat.tsx                 — Chat placeholder (screen 04)
│   │   ├── thesis.tsx               — Thesis list placeholder (screen 03a)
│   │   ├── notifications.tsx        — Notifications (screen 13)
│   │   └── profile.tsx              — Profile (screen 10)
│   └── (app)/
│       ├── _layout.tsx              — App stack layout
│       ├── settings.tsx             — Settings (screen 12)
│       ├── edit-profile.tsx         — Edit profile (screen 10a)
│       └── subscription.tsx         — Subscription (screen 11)
├── components/
│   ├── ui/
│   │   ├── Button.tsx               — Primary/Secondary/Outline buttons
│   │   ├── TextInput.tsx            — Styled text input
│   │   ├── Card.tsx                 — Card container
│   │   ├── Toggle.tsx               — Toggle switch
│   │   ├── StatusBadge.tsx          — Colored status badge
│   │   └── BottomSheet.tsx          — Bottom sheet wrapper
│   ├── FloatingNavBar.tsx           — Floating pill navbar (matching Figma)
│   ├── BackButton.tsx               — Vector back arrow (RTL-aware)
│   └── ThemeProvider.tsx            — Dark/light theme context
├── lib/
│   ├── supabase.ts                  — Supabase client init
│   ├── i18n.ts                      — i18next config + RTL setup
│   └── storage.ts                   — AsyncStorage helpers
├── stores/
│   ├── auth-store.ts                — Auth state (user, session)
│   ├── settings-store.ts            — Language, theme preferences
│   └── index.ts                     — Re-exports
├── locales/
│   ├── ar.json                      — Arabic translations
│   ├── en.json                      — English translations
│   └── fr.json                      — French translations
├── constants/
│   ├── colors.ts                    — Theme color tokens (dark/light)
│   └── typography.ts                — Font sizes, weights
├── hooks/
│   ├── useThemeColors.ts            — Get current theme colors
│   └── useRTL.ts                    — RTL-aware style helpers
├── tailwind.config.js               — NativeWind config with custom colors
├── global.css                       — Tailwind base styles
├── app.json                         — Expo config
├── package.json
└── tsconfig.json
```

---

### Task 1: Expo Project Scaffold

**Files:**
- Create: `modakerati/package.json`
- Create: `modakerati/app.json`
- Create: `modakerati/tsconfig.json`
- Create: `modakerati/tailwind.config.js`
- Create: `modakerati/global.css`
- Create: `modakerati/babel.config.js`
- Create: `modakerati/metro.config.js`

- [ ] **Step 1: Create the Expo project**

```bash
cd ~/
npx create-expo-app@latest modakerati --template blank-typescript
cd modakerati
```

- [ ] **Step 2: Install core dependencies**

```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar expo-splash-screen expo-font
npx expo install nativewind tailwindcss react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-screens
npx expo install @react-native-async-storage/async-storage
npm install zustand lucide-react-native react-native-svg
```

- [ ] **Step 3: Install i18n dependencies**

```bash
npm install i18next react-i18next
npx expo install expo-localization
```

- [ ] **Step 4: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js react-native-url-polyfill
npx expo install expo-secure-store
```

- [ ] **Step 5: Configure NativeWind — create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--color-bg-primary)",
          surface: "var(--color-bg-surface)",
          card: "var(--color-bg-card)",
          modal: "var(--color-bg-modal)",
          input: "var(--color-bg-input)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          placeholder: "var(--color-text-placeholder)",
        },
        brand: {
          primary: "#5C6BFF",
          "primary-light": "#7A8CFF",
          accent: "#33D6A6",
        },
        semantic: {
          success: "#33D6A6",
          warning: "#FF9933",
          error: "#FF5959",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "14px",
        xl: "16px",
        full: "100px",
        navbar: "28px",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Create `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create `metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 8: Create `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 9: Update `app.json`**

```json
{
  "expo": {
    "name": "Modakerati",
    "slug": "modakerati",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "modakerati",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#121220"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.modakerati.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#121220"
      },
      "package": "com.modakerati.app"
    },
    "plugins": ["expo-router", "expo-localization", "expo-secure-store"]
  }
}
```

- [ ] **Step 10: Verify project runs**

```bash
npx expo start
```

Expected: Expo dev server starts, blank screen renders on device/emulator.

- [ ] **Step 11: Commit**

```bash
git init
echo "node_modules/\n.expo/\ndist/\n.env" > .gitignore
git add .
git commit -m "chore: scaffold Expo project with NativeWind, i18n, Supabase deps"
```

---

### Task 2: Theme System (Dark/Light)

**Files:**
- Create: `constants/colors.ts`
- Create: `constants/typography.ts`
- Create: `components/ThemeProvider.tsx`
- Create: `hooks/useThemeColors.ts`
- Create: `stores/settings-store.ts`

- [ ] **Step 1: Create `constants/colors.ts`**

```ts
export const colors = {
  dark: {
    bgPrimary: "#121220",
    bgSurface: "#232338",
    bgCard: "#1C1C2E",
    bgModal: "#171726",
    bgInput: "#1A1A28",
    textPrimary: "#FFFFFF",
    textSecondary: "#9999AE",
    textPlaceholder: "#666678",
    brandPrimary: "#5C6BFF",
    brandPrimaryLight: "#7A8CFF",
    brandAccent: "#33D6A6",
    semanticSuccess: "#33D6A6",
    semanticWarning: "#FF9933",
    semanticError: "#FF5959",
    chatAiBubble: "#1E2138",
    chatUserBubble: "#5C6BFF",
    navBar: "#212133",
    navInactive: "#8D8D9E",
    navInactiveLabel: "#737385",
    borderDefault: "#333346",
    borderSubtle: "#232338",
  },
  light: {
    bgPrimary: "#FAFAFE",
    bgSurface: "#F0F0F5",
    bgCard: "#FFFFFF",
    bgModal: "#F8F8FA",
    bgInput: "#F2F2F7",
    textPrimary: "#1A1A26",
    textSecondary: "#737385",
    textPlaceholder: "#A6A6B3",
    brandPrimary: "#4D5CEB",
    brandPrimaryLight: "#5C6BFF",
    brandAccent: "#26B88C",
    semanticSuccess: "#26B88C",
    semanticWarning: "#E69919",
    semanticError: "#E64040",
    chatAiBubble: "#EDEEF8",
    chatUserBubble: "#4D5CEB",
    navBar: "#FFFFFF",
    navInactive: "#8D8D9E",
    navInactiveLabel: "#737385",
    borderDefault: "#E0E0E6",
    borderSubtle: "#EDEDF0",
  },
} as const;

export type ThemeColors = typeof colors.dark;
export type ThemeName = "dark" | "light";
```

- [ ] **Step 2: Create `constants/typography.ts`**

```ts
export const typography = {
  heading1: { fontSize: 24, fontWeight: "700" as const },
  heading2: { fontSize: 20, fontWeight: "700" as const },
  heading3: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodySmall: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 11, fontWeight: "500" as const },
  button: { fontSize: 16, fontWeight: "600" as const },
  label: { fontSize: 13, fontWeight: "500" as const },
  navLabel: { fontSize: 10, fontWeight: "400" as const },
} as const;
```

- [ ] **Step 3: Create `stores/settings-store.ts`**

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeName } from "@/constants/colors";

type Language = "ar" | "en" | "fr";

interface SettingsState {
  theme: ThemeName;
  language: Language;
  hasCompletedOnboarding: boolean;
  setTheme: (theme: ThemeName) => void;
  setLanguage: (language: Language) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      language: "fr",
      hasCompletedOnboarding: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "modakerati-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 4: Create `hooks/useThemeColors.ts`**

```ts
import { colors, type ThemeColors } from "@/constants/colors";
import { useSettingsStore } from "@/stores/settings-store";

export function useThemeColors(): ThemeColors {
  const theme = useSettingsStore((s) => s.theme);
  return colors[theme];
}
```

- [ ] **Step 5: Create `components/ThemeProvider.tsx`**

```tsx
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useSettingsStore } from "@/stores/settings-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      {children}
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add constants/ stores/ hooks/ components/ThemeProvider.tsx
git commit -m "feat: add dark/light theme system with Zustand persistence"
```

---

### Task 3: Internationalization (i18n) + RTL

**Files:**
- Create: `locales/ar.json`
- Create: `locales/en.json`
- Create: `locales/fr.json`
- Create: `lib/i18n.ts`
- Create: `hooks/useRTL.ts`

- [ ] **Step 1: Create `locales/en.json`**

```json
{
  "common": {
    "continue": "Continue",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "back": "Back",
    "next": "Next",
    "skip": "Skip",
    "retry": "Retry",
    "apply": "Apply",
    "refresh": "Refresh",
    "search": "Search",
    "seeAll": "See all"
  },
  "nav": {
    "home": "Home",
    "chat": "Chat",
    "thesis": "Thesis",
    "notifications": "Notifications",
    "profile": "Profile"
  },
  "onboarding": {
    "slide1Title": "Chat with AI to\nBuild Your Thesis",
    "slide1Desc": "Tell AI about each chapter and section.\nIt generates structured, academic content\ntailored to your university's format.",
    "chooseLanguage": "Choose your language"
  },
  "auth": {
    "welcomeTo": "Welcome to",
    "appName": "Modakerati",
    "signInSubtitle": "Sign in to continue building your thesis",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "fullName": "Full Name",
    "university": "University",
    "forgotPassword": "Forgot password?",
    "signIn": "Sign In",
    "signUp": "Sign Up",
    "createAccount": "Create Account",
    "startBuilding": "Start building your thesis with AI",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "continueGoogle": "Continue with Google",
    "continueApple": "Continue with Apple",
    "or": "or",
    "forgotTitle": "Forgot Password?",
    "forgotDesc": "Enter your email and we'll send you\na verification code to reset your password.",
    "sendResetCode": "Send Reset Code",
    "backToSignIn": "Back to Sign In",
    "checkEmail": "Check Your Email",
    "codeSentTo": "We sent a 6-digit code to",
    "verifyCode": "Verify Code",
    "didntReceive": "Didn't receive a code?",
    "resend": "Resend",
    "createNewPassword": "Create New Password",
    "newPasswordDesc": "Your new password must be different\nfrom your previous passwords.",
    "newPassword": "New Password",
    "resetPassword": "Reset Password",
    "termsAgree": "By signing up, you agree to our Terms\nof Service and Privacy Policy"
  },
  "home": {
    "goodMorning": "Good morning",
    "newThesis": "New\nThesis",
    "importDocx": "Import\n.docx",
    "templates": "Templates",
    "aiAssist": "AI\nAssist",
    "recentTheses": "Recent Theses",
    "chapters": "chapters",
    "noThesesYet": "No Theses Yet",
    "noThesesDesc": "Start your academic journey.\nCreate your first thesis with AI assistance.",
    "createFirst": "Create Your First Thesis",
    "importExisting": "Import Existing .docx"
  },
  "thesis": {
    "myTheses": "My Theses",
    "all": "All",
    "active": "Active",
    "completed": "Completed",
    "archived": "Archived",
    "thesisStructure": "Thesis Structure",
    "addChapter": "Add",
    "done": "Done",
    "inProgress": "In Progress",
    "notStarted": "Not Started",
    "pending": "Pending"
  },
  "chat": {
    "askPlaceholder": "Ask about your thesis...",
    "aiWriting": "AI is Writing...",
    "generating": "Generating"
  },
  "editor": {
    "sectionEditor": "Section Editor",
    "wordCount": "words",
    "characters": "chars",
    "aiEnhance": "AI Enhance"
  },
  "export": {
    "exportThesis": "Export Thesis",
    "chooseFormat": "Choose Format",
    "wordDoc": "Word Document",
    "pdfDoc": "PDF Document",
    "latexSource": "LaTeX Source",
    "options": "Options",
    "includeCover": "Include cover page",
    "includeToc": "Include table of contents",
    "includeRefs": "Include references",
    "exportAs": "Export as",
    "exportComplete": "Export Complete!",
    "shareFile": "Share File",
    "openInFiles": "Open in Files"
  },
  "format": {
    "pageLayout": "Page Layout",
    "autoFix": "Auto-Fix",
    "margins": "Margins",
    "typography": "Typography",
    "pageSetup": "Page Setup",
    "applyLayout": "Apply Layout to Thesis",
    "autoNumbering": "Auto Numbering",
    "applyNumbering": "Apply Numbering",
    "tableOfContents": "Table of Contents",
    "generateToc": "Generate TOC in Document",
    "listOfFigures": "List of Figures",
    "generateFigures": "Generate Figures List",
    "listOfTables": "List of Tables",
    "generateTables": "Generate Tables List"
  },
  "profile": {
    "profile": "Profile",
    "proPlan": "Pro Plan",
    "theses": "Theses",
    "chapters": "Chapters",
    "words": "Words",
    "universityInfo": "University Information",
    "editProfile": "Edit Profile",
    "manageSubscription": "Manage Subscription",
    "helpSupport": "Help & Support",
    "logOut": "Log Out",
    "changePhoto": "Change Photo"
  },
  "settings": {
    "settings": "Settings",
    "general": "General",
    "language": "Language",
    "theme": "Theme",
    "aiModel": "AI Model",
    "notifications": "Notifications",
    "pushNotifications": "Push Notifications",
    "aiSuggestions": "AI Suggestions",
    "exportReminders": "Export Reminders",
    "dataPrivacy": "Data & Privacy",
    "cloudSync": "Cloud Sync",
    "offlineStorage": "Offline Storage",
    "clearCache": "Clear Cache",
    "deleteAccount": "Delete Account",
    "about": "About",
    "version": "Version",
    "termsOfService": "Terms of Service",
    "privacyPolicy": "Privacy Policy"
  },
  "payment": {
    "upgradeToPro": "Upgrade to Pro",
    "unlockAll": "Unlock unlimited AI assistance and all features",
    "recommended": "RECOMMENDED",
    "month": "/month",
    "proStudent": "Pro Student",
    "proResearcher": "Pro+ Researcher",
    "paymentMethods": "Payment Methods",
    "subscribe": "Subscribe",
    "payment": "Payment",
    "orderSummary": "Order Summary",
    "plan": "Plan",
    "duration": "Duration",
    "price": "Price",
    "paymentMethod": "Payment Method",
    "cardNumber": "Card Number",
    "expiry": "Expiry",
    "cvv": "CVV",
    "securedBy": "Secured by Chargily",
    "paymentSuccessful": "Payment Successful!",
    "welcomePro": "Welcome to Pro! You now have\nunlimited AI chat and all features.",
    "startBuilding": "Start Building Your Thesis",
    "paymentFailed": "Payment Failed",
    "paymentFailedDesc": "Your payment could not be processed.\nPlease check your card details and try again.",
    "tryAgain": "Try Again",
    "useDifferent": "Use Different Payment Method"
  },
  "network": {
    "noConnection": "No Connection",
    "offlineDesc": "You're currently offline.\nYour work is saved locally and will\nsync when you're back online.",
    "availableOffline": "Available offline:",
    "readEdit": "Read & edit saved sections",
    "viewStructure": "View thesis structure",
    "cachedTemplates": "Access cached templates",
    "retryConnection": "Retry Connection",
    "continueOffline": "Continue in Offline Mode"
  }
}
```

- [ ] **Step 2: Create `locales/fr.json`**

```json
{
  "common": {
    "continue": "Continuer",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "back": "Retour",
    "next": "Suivant",
    "skip": "Passer",
    "retry": "Reessayer",
    "apply": "Appliquer",
    "refresh": "Actualiser",
    "search": "Rechercher",
    "seeAll": "Voir tout"
  },
  "nav": {
    "home": "Accueil",
    "chat": "Chat",
    "thesis": "Memoire",
    "notifications": "Notifications",
    "profile": "Profil"
  },
  "onboarding": {
    "slide1Title": "Discutez avec l'IA pour\nconstruire votre memoire",
    "slide1Desc": "Expliquez chaque chapitre et section a l'IA.\nElle genere un contenu academique structure\nadapte au format de votre universite.",
    "chooseLanguage": "Choisissez votre langue"
  },
  "auth": {
    "welcomeTo": "Bienvenue sur",
    "appName": "Modakerati",
    "signInSubtitle": "Connectez-vous pour continuer votre memoire",
    "email": "E-mail",
    "password": "Mot de passe",
    "confirmPassword": "Confirmer le mot de passe",
    "fullName": "Nom complet",
    "university": "Universite",
    "forgotPassword": "Mot de passe oublie ?",
    "signIn": "Se connecter",
    "signUp": "S'inscrire",
    "createAccount": "Creer un compte",
    "startBuilding": "Commencez a construire votre memoire avec l'IA",
    "noAccount": "Pas encore de compte ?",
    "hasAccount": "Vous avez deja un compte ?",
    "continueGoogle": "Continuer avec Google",
    "continueApple": "Continuer avec Apple",
    "or": "ou",
    "forgotTitle": "Mot de passe oublie ?",
    "forgotDesc": "Entrez votre e-mail et nous vous enverrons\nun code de verification.",
    "sendResetCode": "Envoyer le code",
    "backToSignIn": "Retour a la connexion",
    "checkEmail": "Verifiez votre e-mail",
    "codeSentTo": "Nous avons envoye un code a 6 chiffres a",
    "verifyCode": "Verifier le code",
    "didntReceive": "Vous n'avez pas recu le code ?",
    "resend": "Renvoyer",
    "createNewPassword": "Creer un nouveau mot de passe",
    "newPasswordDesc": "Votre nouveau mot de passe doit etre different\nde vos mots de passe precedents.",
    "newPassword": "Nouveau mot de passe",
    "resetPassword": "Reinitialiser",
    "termsAgree": "En vous inscrivant, vous acceptez nos\nConditions d'utilisation et Politique de confidentialite"
  },
  "home": {
    "goodMorning": "Bonjour",
    "newThesis": "Nouveau\nMemoire",
    "importDocx": "Importer\n.docx",
    "templates": "Modeles",
    "aiAssist": "IA\nAssistant",
    "recentTheses": "Memoires recents",
    "chapters": "chapitres",
    "noThesesYet": "Aucun memoire",
    "noThesesDesc": "Commencez votre parcours academique.\nCreez votre premier memoire avec l'IA.",
    "createFirst": "Creer votre premier memoire",
    "importExisting": "Importer un .docx existant"
  },
  "thesis": {
    "myTheses": "Mes memoires",
    "all": "Tous",
    "active": "Actifs",
    "completed": "Termines",
    "archived": "Archives",
    "thesisStructure": "Structure du memoire",
    "addChapter": "Ajouter",
    "done": "Termine",
    "inProgress": "En cours",
    "notStarted": "Non commence",
    "pending": "En attente"
  },
  "chat": {
    "askPlaceholder": "Posez une question sur votre memoire...",
    "aiWriting": "L'IA ecrit...",
    "generating": "Generation"
  },
  "editor": {
    "sectionEditor": "Editeur de section",
    "wordCount": "mots",
    "characters": "caracteres",
    "aiEnhance": "Ameliorer par IA"
  },
  "export": {
    "exportThesis": "Exporter le memoire",
    "chooseFormat": "Choisir le format",
    "wordDoc": "Document Word",
    "pdfDoc": "Document PDF",
    "latexSource": "Source LaTeX",
    "options": "Options",
    "includeCover": "Inclure la page de garde",
    "includeToc": "Inclure la table des matieres",
    "includeRefs": "Inclure les references",
    "exportAs": "Exporter en",
    "exportComplete": "Exportation terminee !",
    "shareFile": "Partager le fichier",
    "openInFiles": "Ouvrir dans Fichiers"
  },
  "format": {
    "pageLayout": "Mise en page",
    "autoFix": "Auto-corriger",
    "margins": "Marges",
    "typography": "Typographie",
    "pageSetup": "Configuration de page",
    "applyLayout": "Appliquer la mise en page",
    "autoNumbering": "Numerotation automatique",
    "applyNumbering": "Appliquer la numerotation",
    "tableOfContents": "Table des matieres",
    "generateToc": "Generer la table des matieres",
    "listOfFigures": "Liste des figures",
    "generateFigures": "Generer la liste des figures",
    "listOfTables": "Liste des tableaux",
    "generateTables": "Generer la liste des tableaux"
  },
  "profile": {
    "profile": "Profil",
    "proPlan": "Plan Pro",
    "theses": "Memoires",
    "chapters": "Chapitres",
    "words": "Mots",
    "universityInfo": "Informations universitaires",
    "editProfile": "Modifier le profil",
    "manageSubscription": "Gerer l'abonnement",
    "helpSupport": "Aide et support",
    "logOut": "Deconnexion",
    "changePhoto": "Changer la photo"
  },
  "settings": {
    "settings": "Parametres",
    "general": "General",
    "language": "Langue",
    "theme": "Theme",
    "aiModel": "Modele IA",
    "notifications": "Notifications",
    "pushNotifications": "Notifications push",
    "aiSuggestions": "Suggestions IA",
    "exportReminders": "Rappels d'exportation",
    "dataPrivacy": "Donnees et confidentialite",
    "cloudSync": "Synchronisation cloud",
    "offlineStorage": "Stockage hors ligne",
    "clearCache": "Vider le cache",
    "deleteAccount": "Supprimer le compte",
    "about": "A propos",
    "version": "Version",
    "termsOfService": "Conditions d'utilisation",
    "privacyPolicy": "Politique de confidentialite"
  },
  "payment": {
    "upgradeToPro": "Passer au Pro",
    "unlockAll": "Debloquez l'assistance IA illimitee et toutes les fonctionnalites",
    "recommended": "RECOMMANDE",
    "month": "/mois",
    "proStudent": "Pro Etudiant",
    "proResearcher": "Pro+ Chercheur",
    "paymentMethods": "Modes de paiement",
    "subscribe": "S'abonner",
    "payment": "Paiement",
    "orderSummary": "Resume de la commande",
    "plan": "Plan",
    "duration": "Duree",
    "price": "Prix",
    "paymentMethod": "Mode de paiement",
    "cardNumber": "Numero de carte",
    "expiry": "Expiration",
    "cvv": "CVV",
    "securedBy": "Securise par Chargily",
    "paymentSuccessful": "Paiement reussi !",
    "welcomePro": "Bienvenue dans Pro ! Vous avez maintenant\nun chat IA illimite et toutes les fonctionnalites.",
    "startBuilding": "Commencer a construire votre memoire",
    "paymentFailed": "Echec du paiement",
    "paymentFailedDesc": "Votre paiement n'a pas pu etre traite.\nVerifiez vos informations et reessayez.",
    "tryAgain": "Reessayer",
    "useDifferent": "Utiliser un autre mode de paiement"
  },
  "network": {
    "noConnection": "Pas de connexion",
    "offlineDesc": "Vous etes actuellement hors ligne.\nVotre travail est sauvegarde localement.",
    "availableOffline": "Disponible hors ligne :",
    "readEdit": "Lire et modifier les sections sauvegardees",
    "viewStructure": "Voir la structure du memoire",
    "cachedTemplates": "Acceder aux modeles en cache",
    "retryConnection": "Reessayer la connexion",
    "continueOffline": "Continuer hors ligne"
  }
}
```

- [ ] **Step 3: Create `locales/ar.json`**

```json
{
  "common": {
    "continue": "متابعة",
    "cancel": "إلغاء",
    "save": "حفظ",
    "delete": "حذف",
    "back": "رجوع",
    "next": "التالي",
    "skip": "تخطي",
    "retry": "إعادة المحاولة",
    "apply": "تطبيق",
    "refresh": "تحديث",
    "search": "بحث",
    "seeAll": "عرض الكل"
  },
  "nav": {
    "home": "الرئيسية",
    "chat": "المحادثة",
    "thesis": "المذكرة",
    "notifications": "الإشعارات",
    "profile": "الملف الشخصي"
  },
  "onboarding": {
    "slide1Title": "تحدث مع الذكاء الاصطناعي\nلبناء مذكرتك",
    "slide1Desc": "اشرح كل فصل وقسم للذكاء الاصطناعي.\nيقوم بتوليد محتوى أكاديمي منظم\nمتوافق مع معايير جامعتك.",
    "chooseLanguage": "اختر لغتك"
  },
  "auth": {
    "welcomeTo": "مرحباً بك في",
    "appName": "مذكرتي",
    "signInSubtitle": "سجل دخولك لمتابعة بناء مذكرتك",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "confirmPassword": "تأكيد كلمة المرور",
    "fullName": "الاسم الكامل",
    "university": "الجامعة",
    "forgotPassword": "نسيت كلمة المرور؟",
    "signIn": "تسجيل الدخول",
    "signUp": "إنشاء حساب",
    "createAccount": "إنشاء حساب جديد",
    "startBuilding": "ابدأ ببناء مذكرتك مع الذكاء الاصطناعي",
    "noAccount": "ليس لديك حساب؟",
    "hasAccount": "لديك حساب بالفعل؟",
    "continueGoogle": "المتابعة مع Google",
    "continueApple": "المتابعة مع Apple",
    "or": "أو",
    "forgotTitle": "نسيت كلمة المرور؟",
    "forgotDesc": "أدخل بريدك الإلكتروني وسنرسل لك\nرمز التحقق لإعادة تعيين كلمة المرور.",
    "sendResetCode": "إرسال رمز التحقق",
    "backToSignIn": "العودة لتسجيل الدخول",
    "checkEmail": "تحقق من بريدك الإلكتروني",
    "codeSentTo": "أرسلنا رمزاً مكوناً من 6 أرقام إلى",
    "verifyCode": "تحقق من الرمز",
    "didntReceive": "لم تستلم الرمز؟",
    "resend": "إعادة الإرسال",
    "createNewPassword": "إنشاء كلمة مرور جديدة",
    "newPasswordDesc": "يجب أن تكون كلمة المرور الجديدة\nمختلفة عن كلمات المرور السابقة.",
    "newPassword": "كلمة المرور الجديدة",
    "resetPassword": "إعادة التعيين",
    "termsAgree": "بالتسجيل، أنت توافق على\nشروط الاستخدام وسياسة الخصوصية"
  },
  "home": {
    "goodMorning": "صباح الخير",
    "newThesis": "مذكرة\nجديدة",
    "importDocx": "استيراد\n.docx",
    "templates": "القوالب",
    "aiAssist": "مساعد\nالذكاء",
    "recentTheses": "المذكرات الأخيرة",
    "chapters": "فصول",
    "noThesesYet": "لا توجد مذكرات بعد",
    "noThesesDesc": "ابدأ مسيرتك الأكاديمية.\nأنشئ مذكرتك الأولى بمساعدة الذكاء الاصطناعي.",
    "createFirst": "أنشئ مذكرتك الأولى",
    "importExisting": "استيراد ملف .docx موجود"
  },
  "thesis": {
    "myTheses": "مذكراتي",
    "all": "الكل",
    "active": "نشطة",
    "completed": "مكتملة",
    "archived": "مؤرشفة",
    "thesisStructure": "هيكل المذكرة",
    "addChapter": "إضافة",
    "done": "مكتمل",
    "inProgress": "قيد التنفيذ",
    "notStarted": "لم يبدأ",
    "pending": "معلق"
  },
  "chat": {
    "askPlaceholder": "اسأل عن مذكرتك...",
    "aiWriting": "الذكاء الاصطناعي يكتب...",
    "generating": "جاري التوليد"
  },
  "editor": {
    "sectionEditor": "محرر القسم",
    "wordCount": "كلمة",
    "characters": "حرف",
    "aiEnhance": "تحسين بالذكاء"
  },
  "export": {
    "exportThesis": "تصدير المذكرة",
    "chooseFormat": "اختر الصيغة",
    "wordDoc": "مستند Word",
    "pdfDoc": "مستند PDF",
    "latexSource": "مصدر LaTeX",
    "options": "الخيارات",
    "includeCover": "تضمين صفحة الغلاف",
    "includeToc": "تضمين جدول المحتويات",
    "includeRefs": "تضمين المراجع",
    "exportAs": "تصدير كـ",
    "exportComplete": "اكتمل التصدير!",
    "shareFile": "مشاركة الملف",
    "openInFiles": "فتح في الملفات"
  },
  "format": {
    "pageLayout": "تنسيق الصفحة",
    "autoFix": "إصلاح تلقائي",
    "margins": "الهوامش",
    "typography": "الطباعة",
    "pageSetup": "إعدادات الصفحة",
    "applyLayout": "تطبيق التنسيق على المذكرة",
    "autoNumbering": "الترقيم التلقائي",
    "applyNumbering": "تطبيق الترقيم",
    "tableOfContents": "جدول المحتويات",
    "generateToc": "توليد جدول المحتويات",
    "listOfFigures": "قائمة الأشكال",
    "generateFigures": "توليد قائمة الأشكال",
    "listOfTables": "قائمة الجداول",
    "generateTables": "توليد قائمة الجداول"
  },
  "profile": {
    "profile": "الملف الشخصي",
    "proPlan": "خطة Pro",
    "theses": "مذكرات",
    "chapters": "فصول",
    "words": "كلمات",
    "universityInfo": "معلومات الجامعة",
    "editProfile": "تعديل الملف الشخصي",
    "manageSubscription": "إدارة الاشتراك",
    "helpSupport": "المساعدة والدعم",
    "logOut": "تسجيل الخروج",
    "changePhoto": "تغيير الصورة"
  },
  "settings": {
    "settings": "الإعدادات",
    "general": "عام",
    "language": "اللغة",
    "theme": "المظهر",
    "aiModel": "نموذج الذكاء",
    "notifications": "الإشعارات",
    "pushNotifications": "إشعارات الدفع",
    "aiSuggestions": "اقتراحات الذكاء",
    "exportReminders": "تذكيرات التصدير",
    "dataPrivacy": "البيانات والخصوصية",
    "cloudSync": "المزامنة السحابية",
    "offlineStorage": "التخزين المحلي",
    "clearCache": "مسح ذاكرة التخزين",
    "deleteAccount": "حذف الحساب",
    "about": "حول",
    "version": "الإصدار",
    "termsOfService": "شروط الاستخدام",
    "privacyPolicy": "سياسة الخصوصية"
  },
  "payment": {
    "upgradeToPro": "الترقية إلى Pro",
    "unlockAll": "أطلق العنان لمساعدة الذكاء الاصطناعي غير المحدودة وجميع الميزات",
    "recommended": "موصى به",
    "month": "/شهر",
    "proStudent": "Pro طالب",
    "proResearcher": "Pro+ باحث",
    "paymentMethods": "طرق الدفع",
    "subscribe": "اشترك",
    "payment": "الدفع",
    "orderSummary": "ملخص الطلب",
    "plan": "الخطة",
    "duration": "المدة",
    "price": "السعر",
    "paymentMethod": "طريقة الدفع",
    "cardNumber": "رقم البطاقة",
    "expiry": "تاريخ الانتهاء",
    "cvv": "CVV",
    "securedBy": "مؤمن بواسطة Chargily",
    "paymentSuccessful": "تم الدفع بنجاح!",
    "welcomePro": "مرحباً بك في Pro! لديك الآن\nمحادثات ذكاء اصطناعي غير محدودة وجميع الميزات.",
    "startBuilding": "ابدأ ببناء مذكرتك",
    "paymentFailed": "فشل الدفع",
    "paymentFailedDesc": "تعذر معالجة دفعتك.\nتحقق من بيانات بطاقتك وحاول مرة أخرى.",
    "tryAgain": "إعادة المحاولة",
    "useDifferent": "استخدام طريقة دفع أخرى"
  },
  "network": {
    "noConnection": "لا يوجد اتصال",
    "offlineDesc": "أنت غير متصل حالياً.\nعملك محفوظ محلياً وسيتم\nمزامنته عند الاتصال مجدداً.",
    "availableOffline": "متاح بدون اتصال:",
    "readEdit": "قراءة وتعديل الأقسام المحفوظة",
    "viewStructure": "عرض هيكل المذكرة",
    "cachedTemplates": "الوصول للقوالب المخزنة",
    "retryConnection": "إعادة محاولة الاتصال",
    "continueOffline": "المتابعة بدون اتصال"
  }
}
```

- [ ] **Step 4: Create `lib/i18n.ts`**

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

const LANGUAGE_KEY = "modakerati-language";

export const RTL_LANGUAGES = ["ar"];

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang);
}

export async function setLanguageWithRTL(lang: string) {
  const shouldBeRTL = isRTL(lang);
  const currentRTL = I18nManager.isRTL;

  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);

  if (shouldBeRTL !== currentRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    // App needs restart for RTL to take effect
    return true; // signals restart needed
  }
  return false;
}

export async function getStoredLanguage(): Promise<string> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (stored) return stored;

  // Detect device locale
  const locale = Localization.getLocales()[0]?.languageCode ?? "fr";
  if (["ar", "en", "fr"].includes(locale)) return locale;
  return "fr"; // default to French for Algeria
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
```

- [ ] **Step 5: Create `hooks/useRTL.ts`**

```ts
import { I18nManager } from "react-native";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/lib/i18n";

export function useRTL() {
  const { i18n } = useTranslation();
  const rtl = isRTL(i18n.language);

  return {
    isRTL: rtl,
    // Flip direction-dependent styles
    flexDirection: (rtl ? "row-reverse" : "row") as "row" | "row-reverse",
    textAlign: (rtl ? "right" : "left") as "right" | "left",
    // For icons that should flip
    iconRotation: rtl ? "180deg" : "0deg",
    // Margins/paddings that swap in RTL
    start: rtl ? "right" : "left",
    end: rtl ? "left" : "right",
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add locales/ lib/i18n.ts hooks/useRTL.ts
git commit -m "feat: add trilingual i18n (AR/EN/FR) with full RTL support"
```

---

### Task 4: Supabase Client Setup

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/storage.ts`
- Create: `stores/auth-store.ts`
- Create: `.env`

- [ ] **Step 1: Create `.env`**

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 2: Create `lib/storage.ts`**

```ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SecureStore adapter for Supabase auth (works on native, falls back on web)
export const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
```

- [ ] **Step 3: Create `lib/supabase.ts`**

```ts
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { secureStoreAdapter } from "./storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 4: Create `stores/auth-store.ts`**

```ts
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setSession: (session: Session | null) => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      isLoading: false,
    }),

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  },

  signUpWithEmail: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, isAuthenticated: false });
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    get().setSession(session);

    supabase.auth.onAuthStateChange((_event, session) => {
      get().setSession(session);
    });
  },
}));
```

- [ ] **Step 5: Create `stores/index.ts`**

```ts
export { useAuthStore } from "./auth-store";
export { useSettingsStore } from "./settings-store";
```

- [ ] **Step 6: Commit**

```bash
git add lib/ stores/ .env
echo ".env" >> .gitignore
git commit -m "feat: add Supabase client with auth store and secure storage"
```

---

### Task 5: Root Layout + Navigation Structure

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(app)/_layout.tsx`
- Create: `components/FloatingNavBar.tsx`

- [ ] **Step 1: Create `app/_layout.tsx`**

```tsx
import { useEffect, useState } from "react";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { getStoredLanguage } from "@/lib/i18n";
import i18n from "@/lib/i18n";
import "@/global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const { hasCompletedOnboarding } = useSettingsStore();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      const lang = await getStoredLanguage();
      await i18n.changeLanguage(lang);
      await initialize();
      setAppReady(true);
    }
    prepare();
  }, []);

  useEffect(() => {
    if (!appReady || !fontsLoaded) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "(auth)";

    if (!hasCompletedOnboarding) {
      router.replace("/(auth)/onboarding");
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [appReady, fontsLoaded, isAuthenticated, hasCompletedOnboarding]);

  if (!appReady || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Create `app/(auth)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="language" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
```

- [ ] **Step 3: Create `components/FloatingNavBar.tsx`**

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Home, MessageSquare, FileText, Bell, User } from "lucide-react-native";

const TABS = [
  { name: "index", icon: Home, labelKey: "nav.home" },
  { name: "chat", icon: MessageSquare, labelKey: "nav.chat" },
  { name: "thesis", icon: FileText, labelKey: "nav.thesis" },
  { name: "notifications", icon: Bell, labelKey: "nav.notifications" },
  { name: "profile", icon: User, labelKey: "nav.profile" },
] as const;

export function FloatingNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();

  const activeTab = TABS.find((tab) => {
    if (tab.name === "index") return pathname === "/" || pathname === "/(tabs)";
    return pathname.includes(tab.name);
  })?.name ?? "index";

  return (
    <View style={styles.container}>
      {/* Active dot — positioned outside above the card */}
      <View style={styles.dotRow}>
        {TABS.map((tab) => (
          <View key={tab.name} style={styles.dotSlot}>
            {activeTab === tab.name && (
              <View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} />
            )}
          </View>
        ))}
      </View>

      {/* Nav card */}
      <View style={[styles.card, { backgroundColor: colors.navBar }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.name;
          const Icon = tab.icon;
          const color = isActive ? colors.brandPrimary : colors.navInactive;

          return (
            <Pressable
              key={tab.name}
              onPress={() => router.push(`/(tabs)/${tab.name === "index" ? "" : tab.name}`)}
              style={styles.tab}
            >
              <Icon size={22} color={color} strokeWidth={1.8} />
              <Text style={[styles.label, { color: isActive ? colors.brandPrimary : colors.navInactiveLabel }]}>
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: -4, // overlap with card top edge
  },
  dotSlot: {
    flex: 1,
    alignItems: "center",
    height: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tab: {
    alignItems: "center",
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
```

- [ ] **Step 4: Create `app/(tabs)/_layout.tsx`**

```tsx
import { View } from "react-native";
import { Tabs } from "expo-router";
import { FloatingNavBar } from "@/components/FloatingNavBar";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => <FloatingNavBar />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="thesis" />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}
```

- [ ] **Step 5: Create `app/(app)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="settings" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="subscription" />
    </Stack>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/ components/FloatingNavBar.tsx
git commit -m "feat: add root layout, auth/tabs/app navigation, floating navbar"
```

---

### Task 6: Core UI Components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/TextInput.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/BackButton.tsx`

- [ ] **Step 1: Create `components/ui/Button.tsx`**

```tsx
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "accent" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const colors = useThemeColors();

  const bgMap = {
    primary: colors.brandPrimary,
    secondary: colors.bgSurface,
    accent: colors.brandAccent,
    destructive: colors.semanticError,
  };

  const textColorMap = {
    primary: "#FFFFFF",
    secondary: colors.textPrimary,
    accent: colors.bgPrimary,
    destructive: "#FFFFFF",
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: bgMap[variant], opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColorMap[variant]} />
      ) : (
        <Text style={[styles.text, { color: textColorMap[variant] }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
```

- [ ] **Step 2: Create `components/ui/TextInput.tsx`**

```tsx
import { View, Text, TextInput as RNTextInput, StyleSheet, TextInputProps } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useRTL } from "@/hooks/useRTL";

interface Props extends TextInputProps {
  label?: string;
}

export function TextInput({ label, style, ...props }: Props) {
  const colors = useThemeColors();
  const { textAlign } = useRTL();

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary, textAlign }]}>{label}</Text>
      )}
      <RNTextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.bgInput,
            color: colors.textPrimary,
            borderColor: colors.borderSubtle,
            textAlign,
          },
          style,
        ]}
        placeholderTextColor={colors.textPlaceholder}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
```

- [ ] **Step 3: Create `components/ui/Card.tsx`**

```tsx
import { View, StyleSheet, ViewProps } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface CardProps extends ViewProps {
  borderColor?: string;
}

export function Card({ children, borderColor, style, ...props }: CardProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bgCard },
        borderColor && { borderWidth: 1, borderColor },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
  },
});
```

- [ ] **Step 4: Create `components/BackButton.tsx`**

```tsx
import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useRTL } from "@/hooks/useRTL";

export function BackButton() {
  const router = useRouter();
  const colors = useThemeColors();
  const { isRTL } = useRTL();

  return (
    <Pressable onPress={() => router.back()} style={styles.button}>
      <ArrowLeft
        size={22}
        color={colors.textPrimary}
        strokeWidth={2}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
```

- [ ] **Step 5: Commit**

```bash
git add components/
git commit -m "feat: add core UI components (Button, TextInput, Card, BackButton)"
```

---

### Task 7: Screen Shells (Auth + Tabs)

**Files:**
- Create: `app/(auth)/onboarding.tsx`
- Create: `app/(auth)/language.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/chat.tsx`
- Create: `app/(tabs)/thesis.tsx`
- Create: `app/(tabs)/notifications.tsx`
- Create: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Create `app/(auth)/onboarding.tsx`**

```tsx
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Button } from "@/components/ui/Button";

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.content}>
        {/* Illustration placeholder */}
        <View style={[styles.illustration, { backgroundColor: colors.brandPrimary + "1A" }]}>
          <View style={[styles.logoCircle, { backgroundColor: colors.brandPrimary }]} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("onboarding.slide1Title")}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t("onboarding.slide1Desc")}
        </Text>
      </View>

      <View style={styles.bottom}>
        <Button title={t("common.next")} onPress={() => router.push("/(auth)/language")} />
        <Text
          style={[styles.skip, { color: colors.textSecondary }]}
          onPress={() => router.push("/(auth)/language")}
        >
          {t("common.skip")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 24 },
  illustration: { width: 200, height: 200, borderRadius: 100, justifyContent: "center", alignItems: "center" },
  logoCircle: { width: 80, height: 80, borderRadius: 40 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", textAlign: "center" },
  description: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  bottom: { gap: 12, alignItems: "center" },
  skip: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
```

- [ ] **Step 2: Create `app/(auth)/login.tsx`**

```tsx
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { signInWithEmail } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setLoading(true);
    setError("");
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error);
    setLoading(false);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.welcome, { color: colors.textSecondary }]}>{t("auth.welcomeTo")}</Text>
        <Text style={[styles.appName, { color: colors.textPrimary }]}>{t("auth.appName")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("auth.signInSubtitle")}</Text>
      </View>

      <View style={styles.form}>
        <TextInput label={t("auth.email")} placeholder="you@university.dz" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput label={t("auth.password")} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

        {error ? <Text style={{ color: colors.semanticError, fontSize: 13 }}>{error}</Text> : null}

        <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
          <Text style={[styles.forgot, { color: colors.brandPrimaryLight }]}>{t("auth.forgotPassword")}</Text>
        </Pressable>

        <Button title={t("auth.signIn")} onPress={handleSignIn} loading={loading} />
      </View>

      <View style={styles.footer}>
        <View style={styles.signupRow}>
          <Text style={[styles.noAccount, { color: colors.textSecondary }]}>{t("auth.noAccount")}</Text>
          <Pressable onPress={() => router.push("/(auth)/signup")}>
            <Text style={[styles.signupLink, { color: colors.brandPrimaryLight }]}>{t("auth.signUp")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32 },
  header: { alignItems: "center", gap: 8, marginTop: 40 },
  welcome: { fontSize: 16, fontFamily: "Inter_400Regular" },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  form: { flex: 1, gap: 16, marginTop: 40 },
  forgot: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  footer: { alignItems: "center", gap: 16 },
  signupRow: { flexDirection: "row", gap: 4 },
  noAccount: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signupLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
```

- [ ] **Step 3: Create tab screen shells — `app/(tabs)/index.tsx`**

```tsx
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.greeting, { color: colors.textSecondary }]}>{t("home.goodMorning")}</Text>
        <Text style={[styles.name, { color: colors.textPrimary }]}>Hamza</Text>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t("home.recentTheses")}
        </Text>

        {/* Thesis cards will go here in Phase 2 */}
        <View style={[styles.placeholder, { backgroundColor: colors.bgCard }]}>
          <Text style={{ color: colors.textSecondary }}>Thesis cards — Phase 2</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 16 },
  placeholder: { borderRadius: 14, padding: 40, alignItems: "center" },
});
```

- [ ] **Step 4: Create remaining tab shells**

Create `app/(tabs)/chat.tsx`, `app/(tabs)/thesis.tsx`, `app/(tabs)/notifications.tsx`, `app/(tabs)/profile.tsx` — each following the same pattern as `index.tsx` with appropriate title from translations.

```tsx
// app/(tabs)/chat.tsx
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function ChatScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={["top"]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t("nav.chat")}</Text>
        <View style={[styles.placeholder, { backgroundColor: colors.bgCard }]}>
          <Text style={{ color: colors.textSecondary }}>Chat UI — Phase 3</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  placeholder: { flex: 1, borderRadius: 14, padding: 40, alignItems: "center", justifyContent: "center" },
});
```

Repeat the same shell for `thesis.tsx`, `notifications.tsx`, `profile.tsx` — changing the title key and placeholder text.

- [ ] **Step 5: Create auth screen shells**

Create minimal shells for `app/(auth)/language.tsx`, `app/(auth)/signup.tsx`, `app/(auth)/forgot-password.tsx`, `app/(auth)/otp.tsx`, `app/(auth)/reset-password.tsx` — each with the correct layout matching Figma but minimal logic (full implementation in Phase 2).

- [ ] **Step 6: Verify app runs with navigation**

```bash
npx expo start
```

Expected: App opens to onboarding, can navigate to language picker, login, and tab screens. Floating navbar shows with correct active states. Theme colors apply. Translations work.

- [ ] **Step 7: Commit**

```bash
git add app/ components/
git commit -m "feat: add all screen shells with i18n, theme, and floating navbar navigation"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Test dark/light theme toggle**

Verify colors swap correctly by changing `useSettingsStore.getState().setTheme("light")` in a dev console or temporary button.

- [ ] **Step 2: Test RTL by switching to Arabic**

Call `setLanguageWithRTL("ar")` and restart the app. Verify:
- All text aligns right
- Back arrow flips direction
- Navbar items mirror order
- Layout padding swaps correctly

- [ ] **Step 3: Test all three languages**

Switch between `ar`, `en`, `fr` and verify all translation keys render correctly without missing keys.

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "feat: Phase 1 complete — Expo scaffold, auth, i18n/RTL, theme, navigation"
```

---

## Phase Summary

After completing Phase 1, you will have:
- Expo app running with NativeWind styling
- File-based routing (auth stack + tabs + app stack)
- Floating pill navbar matching Figma design (dot outside card)
- Dark/light theme system with Zustand persistence
- Trilingual i18n (AR/EN/FR) with full RTL support
- Supabase client with auth store (email sign in/up)
- Core UI components (Button, TextInput, Card, BackButton)
- Screen shells for all 43 screens

## Next Phases

- **Phase 2:** Thesis Management (CRUD, templates, structure manager, AI wizard)
- **Phase 3:** Chat & AI (conversation UI, streaming, section generation)
- **Phase 4:** Editor & Export (Tiptap editor, auto-formatting, TOC, .docx/PDF/LaTeX)
- **Phase 5:** Payments & Subscription (Chargily/ECCP, plan management)
- **Phase 6:** Offline & Sync (SQLite, PowerSync, network error handling)
- **Phase 7:** Polish & Launch (animations, performance, testing, deployment)
