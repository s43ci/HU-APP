import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DarkPalette, LightPalette, type Palette, type ReaderTheme } from '@/constants/theme';
import { setImportedContent } from '@/data/content';
import type { ImportedBooklet, StageId } from '@/data/types';

export type Appearance = 'system' | 'light' | 'dark';

export type LastRead = { topicId: string; offset: number; at: number };

type Persisted = {
  profile: { name: string; email: string; stageId: StageId } | null;
  appearance: Appearance;
  language: 'English' | 'العربية';
  notifications: boolean;
  fontScale: number;
  /** 'auto' follows the app's light/dark appearance. */
  readerTheme: ReaderTheme | 'auto';
  importedBooklets: ImportedBooklet[];
  /** ISO dates (YYYY-MM-DD) on which the student studied, for the streak. */
  studyDays: string[];
  favoriteBooklets: string[];
  favoriteTopics: string[];
  completedTopics: string[];
  topicProgress: Record<string, number>; // 0..1 scroll progress per topic
  lastRead: LastRead | null;
  recent: string[]; // topic ids, newest first
  highlights: Record<string, number[]>; // topicId -> block indexes
  bookmarks: string[]; // topic ids
  quiz: { answered: number; correct: number };
  studySeconds: number;
  /** Subjects unlocked for this student (granted by admin after payment). */
  unlockedSubjects: string[];
};

const DEFAULTS: Persisted = {
  profile: null,
  appearance: 'system',
  language: 'English',
  notifications: true,
  fontScale: 1,
  readerTheme: 'auto',
  importedBooklets: [],
  studyDays: [],
  favoriteBooklets: [],
  favoriteTopics: [],
  completedTopics: [],
  topicProgress: {},
  lastRead: null,
  recent: [],
  highlights: {},
  bookmarks: [],
  quiz: { answered: 0, correct: 0 },
  studySeconds: 0,
  unlockedSubjects: [],
};

const KEY = 'booklit.state.v1';

type Store = Persisted & {
  ready: boolean;
  palette: Palette;
  isDark: boolean;
  set: (patch: Partial<Persisted>) => void;
  toggleTheme: () => void;
  toggleFavoriteBooklet: (id: string) => void;
  toggleFavoriteTopic: (id: string) => void;
  toggleBookmark: (id: string) => void;
  toggleHighlight: (topicId: string, blockIndex: number) => void;
  saveReading: (topicId: string, offset: number, progress: number) => void;
  markComplete: (topicId: string) => void;
  recordAnswer: (correct: boolean) => void;
  addStudySeconds: (s: number) => void;
  logOut: () => void;
  addImported: (b: ImportedBooklet) => void;
  removeImported: (id: string) => void;
  streak: number;
  contentVersion: number;
};

const Ctx = createContext<Store | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

function computeStreak(days: string[]) {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1); // today not studied yet: count up to yesterday
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [id, ...arr]);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setState({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
    }, 300);
  }, [state, ready]);

  const update = useCallback((fn: (s: Persisted) => Partial<Persisted>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);

  // Keep the shared content arrays in sync with the student's uploads before children render.
  const contentVersion = useMemo(() => {
    setImportedContent(state.importedBooklets);
    return state.importedBooklets.length;
  }, [state.importedBooklets]);

  const isDark = state.appearance === 'dark' || (state.appearance === 'system' && scheme === 'dark');

  const value = useMemo<Store>(
    () => ({
      ...state,
      ready,
      isDark,
      palette: isDark ? DarkPalette : LightPalette,
      set: (patch) => update(() => patch),
      toggleTheme: () => update(() => ({ appearance: isDark ? 'light' : 'dark' })),
      toggleFavoriteBooklet: (id) => update((s) => ({ favoriteBooklets: toggle(s.favoriteBooklets, id) })),
      toggleFavoriteTopic: (id) => update((s) => ({ favoriteTopics: toggle(s.favoriteTopics, id) })),
      toggleBookmark: (id) => update((s) => ({ bookmarks: toggle(s.bookmarks, id) })),
      toggleHighlight: (topicId, i) =>
        update((s) => {
          const cur = s.highlights[topicId] ?? [];
          const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
          return { highlights: { ...s.highlights, [topicId]: next } };
        }),
      saveReading: (topicId, offset, progress) =>
        update((s) => ({
          lastRead: { topicId, offset, at: Date.now() },
          recent: [topicId, ...s.recent.filter((x) => x !== topicId)].slice(0, 20),
          topicProgress: { ...s.topicProgress, [topicId]: Math.max(s.topicProgress[topicId] ?? 0, progress) },
          completedTopics:
            progress >= 0.98 && !s.completedTopics.includes(topicId) ? [...s.completedTopics, topicId] : s.completedTopics,
        })),
      markComplete: (topicId) =>
        update((s) => ({
          completedTopics: s.completedTopics.includes(topicId) ? s.completedTopics : [...s.completedTopics, topicId],
          topicProgress: { ...s.topicProgress, [topicId]: 1 },
        })),
      recordAnswer: (correct) =>
        update((s) => ({ quiz: { answered: s.quiz.answered + 1, correct: s.quiz.correct + (correct ? 1 : 0) } })),
      addStudySeconds: (sec) =>
        update((s) => ({
          studySeconds: s.studySeconds + sec,
          studyDays: s.studyDays.includes(today()) ? s.studyDays : [...s.studyDays, today()].slice(-400),
        })),
      addImported: (b) => update((s) => ({ importedBooklets: [b, ...s.importedBooklets.filter((x) => x.id !== b.id)] })),
      removeImported: (id) =>
        update((s) => ({
          importedBooklets: s.importedBooklets.filter((x) => x.id !== id),
          favoriteBooklets: s.favoriteBooklets.filter((x) => x !== id),
          lastRead: s.lastRead?.topicId.startsWith(`${id}--`) ? null : s.lastRead,
        })),
      streak: computeStreak(state.studyDays),
      contentVersion,
      logOut: () => setState({ ...DEFAULTS, appearance: state.appearance }),
    }),
    [state, ready, isDark, update, contentVersion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStoreProvider');
  return v;
}

export function usePalette() {
  return useApp().palette;
}
