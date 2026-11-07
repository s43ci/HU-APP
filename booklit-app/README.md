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
- Ask AI calls the proxy in `../ai-proxy` when `EXPO_PUBLIC_AI_URL` is set in `.env`, and otherwise answers from the booklet text (demo mode).
