# Booklit: student app

Expo + Expo Router + TypeScript.

```bash
npm install
npx expo start      # scan the QR code with Expo Go
npx tsc --noEmit    # typecheck
npx expo lint       # lint
```

- Screens live in `src/app/` (tabs in `src/app/(tabs)/`).
- Fixed header: `src/components/app-header.tsx`. Floating tab bar: `src/components/pill-tab-bar.tsx`.
- Sample content: `src/data/content.ts`. Local state (progress, favorites, last position): `src/store/app-store.tsx`.
- Ask AI: the server route `src/app/api/ask+api.ts` (Gemini `gemini-3.5-flash-lite`) is deployed on EAS Hosting at `https://booklit.expo.app/api/ask`. The key is the EAS env var `GEMINI_API_KEY` (production, sensitive) and is never in the app bundle.
