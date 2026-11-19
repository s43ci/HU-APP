import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { DarkPalette, LightPalette, type Palette, type ReaderTheme } from '@/constants/theme';
import { setImportedContent, setUniversity, subjects } from '@/data/content';
import { api, getSession, onSessionChange, setSession, type Account, type PlanConfig, type Session, type SubRequest } from '@/lib/api';
import { loadBig, saveBig } from '@/lib/big-store';
import { deleteBookletImages } from '@/lib/editor';
import { logError } from '@/lib/log';
import { DEFAULT_READER_PREFS, type Mark, type ReaderPrefs, type Role, type Stroke } from '@/data/annotations';
import { EMPTY_CATALOG, type Catalog, type ImportedBooklet, type Mcq, type StageId } from '@/data/types';

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
  /** Account type (see data/annotations.ts). */
  role: Role;
  /** Plan chosen before admin mode was unlocked, restored when leaving admin mode. */
  planBeforeAdmin: Role;
  /** Word-level highlights and notes per topic. */
  marks: Record<string, Mark[]>;
  /** Freehand drawings per topic. */
  drawings: Record<string, Stroke[]>;
  readerPrefs: ReaderPrefs;
  /** MCQs imported by the admin from question banks for course (built-in) topics. */
  extraMcqs: Mcq[];
  /** Signed-in BOOKLIT account (server). */
  session: Session | null;
  account: Account | null;
  plans: PlanConfig | null;
  myRequest: SubRequest | null;
  /** Booklets and question-bank MCQs the BOOKLIT team published for everyone (kept for offline reading). */
  published: { updatedAt: number; booklets: ImportedBooklet[]; extraMcqs: Mcq[]; bankMcqs: Mcq[]; versions: Record<string, number> };
  /** Studio booklet id -> its local updatedAt when last published. */
  publishedMeta: Record<string, number>;
  /** Plan needed to open each subject, set by the admin (missing = built-in default). */
  subjectAccess: Record<string, 'free' | 'pro' | 'premium'>;
  /** Booklets the admin deleted for everyone. */
  hiddenBooklets: string[];
  /** Subjects, booklet order, universities and AI rules set by the admin. */
  catalog: Catalog;
  /** The student's university (filters the subjects they see). */
  universityId: string | null;
};

const EMPTY_PUBLISHED: Persisted['published'] = { updatedAt: 0, booklets: [], extraMcqs: [], bankMcqs: [], versions: {} };

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
  role: 'pro',
  planBeforeAdmin: 'pro',
  marks: {},
  drawings: {},
  readerPrefs: DEFAULT_READER_PREFS,
  extraMcqs: [],
  session: null,
  account: null,
  plans: null,
  myRequest: null,
  published: EMPTY_PUBLISHED,
  publishedMeta: {},
  subjectAccess: {},
  hiddenBooklets: [],
  catalog: EMPTY_CATALOG,
  universityId: null,
};

const KEY = 'booklit.state.v1';
/**
 * The big parts of the state are saved apart (src/lib/big-store.ts): together they outgrow the ~5 MB
 * the small store allows on the web (and AsyncStorage's limits on Android), and saving then fails
 * silently, which lost booklets added after the limit was reached.
 */
const BIG = ['importedBooklets', 'published', 'extraMcqs'] as const;
type BigKey = (typeof BIG)[number];

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
  updateImported: (b: ImportedBooklet) => void;
  addMark: (topicId: string, m: Mark) => void;
  updateMark: (topicId: string, id: string, patch: Partial<Mark>) => void;
  removeMark: (topicId: string, id: string) => void;
  setDrawing: (topicId: string, strokes: Stroke[]) => void;
  setReaderPrefs: (patch: Partial<ReaderPrefs>) => void;
  addExtraMcqs: (list: Mcq[]) => void;
  /** Staff (moderator) or admin: can open the admin dashboard. */
  isStaff: boolean;
  isAdmin: boolean;
  can: (perm: Account['perms'][number]) => boolean;
  /** Find a Studio / published booklet by id (local copy first). */
  findBooklet: (id: string) => ImportedBooklet | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (p: { email: string; password: string; name: string; stageId: StageId; universityId?: string | null }) => Promise<void>;
  /** Re-read the account, plans and published content from the server. */
  sync: () => Promise<void>;
  setAccount: (a: Account, session?: Session) => void;
  setMyRequest: (r: SubRequest | null) => void;
  /** Switch university (saved on this device at once and on the account in the background). */
  chooseUniversity: (id: string | null) => void;
  markPublished: (b: ImportedBooklet) => void;
  canEdit: boolean;
  canUpload: boolean;
  /** Premium and admin can turn their own files into booklets (personal library). */
  canAddFiles: boolean;
  streak: number;
  contentVersion: number;
};

const Ctx = createContext<Store | null>(null);

const PLAN_RANK = { free: 0, pro: 1, premium: 2 } as const;
/** The plan a subject needs: the admin's choice, else free subjects are free and the rest need Pro. */
export const accessOf = (id: string, isFree: boolean, map: Record<string, 'free' | 'pro' | 'premium'>) => map[id] ?? (isFree ? 'free' : 'pro');

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

  // What is saved in the big store (by reference, so unchanged parts are not written again).
  const savedBig = useRef<Partial<Record<BigKey, unknown>>>({});
  // Big parts that could not be read this time: never overwritten, so nothing is lost by a failed read.
  const bigUnreadable = useRef(new Set<BigKey>());

  useEffect(() => {
    (async () => {
      let saved: Persisted = DEFAULTS;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) saved = { ...DEFAULTS, ...JSON.parse(raw) } as Persisted;
      } catch (e) {
        logError('storage', e, { step: 'load' });
      }
      for (const k of BIG) {
        try {
          const v = await loadBig(`state.${k}`);
          if (v !== null) {
            const parsed = JSON.parse(v) as Persisted[BigKey];
            (saved as Record<BigKey, unknown>)[k] = parsed;
            savedBig.current[k] = parsed;
          }
          // Nothing in the big store yet: the value from the small store (older versions) moves over on the next save.
        } catch (e) {
          bigUnreadable.current.add(k);
          logError('storage', e, { step: 'load-big', key: k });
        }
      }
      setSession(saved.session);
      setState(saved);
    })().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        const small: Record<string, unknown> = { ...state };
        for (const k of BIG) {
          if (bigUnreadable.current.has(k)) continue; // keep what the small store had
          if (savedBig.current[k] !== state[k]) {
            try {
              await saveBig(`state.${k}`, JSON.stringify(state[k]));
              savedBig.current[k] = state[k];
            } catch (e) {
              logError('storage', e, { step: 'save-big', key: k });
            }
          }
          // Saved in the big store: the small store keeps only the empty default.
          if (savedBig.current[k] === state[k]) small[k] = DEFAULTS[k];
        }
        await AsyncStorage.setItem(KEY, JSON.stringify(small)).catch((e) => logError('storage', e, { step: 'save' }));
      })();
    }, 300);
  }, [state, ready]);

  const update = useCallback((fn: (s: Persisted) => Partial<Persisted>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);

  // Token refreshes (or a suspended / expired account) flow back into the saved state.
  useEffect(() => {
    onSessionChange((session) => update(() => (session ? { session } : { session: null, account: null, myRequest: null })));
  }, [update]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const syncing = useRef(false);

  /** Account + plans + published content. Cheap when nothing changed (only the small index is read). */
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const cur = stateRef.current;
      const [me, index] = await Promise.all([
        getSession() ? api<{ account: Account; plans: PlanConfig; request: SubRequest | null }>('/api/me').catch(() => null) : Promise.resolve(null),
        api<{ updatedAt: number; booklets: { id: string; updatedAt: number }[]; access?: Persisted['subjectAccess']; hidden?: string[]; catalog?: Catalog }>('/api/content', { auth: false }).catch(() => null),
      ]);
      if (me) update(() => ({ account: me.account, plans: me.plans, myRequest: me.request }));
      if (index?.access && JSON.stringify(index.access) !== JSON.stringify(cur.subjectAccess)) update(() => ({ subjectAccess: index.access ?? {} }));
      if (index?.hidden && JSON.stringify(index.hidden) !== JSON.stringify(cur.hiddenBooklets)) update(() => ({ hiddenBooklets: index.hidden ?? [] }));
      if (index?.catalog && JSON.stringify(index.catalog) !== JSON.stringify(cur.catalog)) update(() => ({ catalog: { ...EMPTY_CATALOG, ...index.catalog } }));
      // A university chosen on another device follows the account.
      if (me?.account.universityId && !cur.universityId) update(() => ({ universityId: me.account.universityId ?? null }));
      if (index && index.updatedAt !== cur.published.updatedAt) {
        const old = cur.published;
        const keep = new Map(old.booklets.map((b) => [b.id, b]));
        const extras = new Map<string, Mcq[]>();
        old.booklets.forEach((b) => extras.set(b.id, old.extraMcqs.filter((q) => q.topicId.startsWith(`${b.id}--`))));
        const versions: Record<string, number> = {};
        const booklets: ImportedBooklet[] = [];
        // New or changed booklets are downloaded six at a time (one by one took long with dozens of booklets).
        const need = index.booklets.filter((e) => !(keep.has(e.id) && old.versions[e.id] === e.updatedAt));
        const got = new Map<string, { booklet: ImportedBooklet; extraMcqs: Mcq[] } | null>();
        for (let i = 0; i < need.length; i += 6)
          await Promise.all(
            need.slice(i, i + 6).map(async (e) => {
              const full = await api<{ booklet: ImportedBooklet; extraMcqs: Mcq[] }>(`/api/content?id=${encodeURIComponent(e.id)}`, { auth: false }).catch(() => null);
              got.set(e.id, full);
            }),
          );
        let missing = 0;
        for (const e of index.booklets) {
          const full = got.get(e.id);
          if (full) {
            booklets.push(full.booklet);
            extras.set(e.id, full.extraMcqs ?? []);
            versions[e.id] = e.updatedAt;
          } else if (keep.has(e.id)) {
            booklets.push(keep.get(e.id)!);
            // Kept an older copy: the version stays old so the next sync tries again.
            if (old.versions[e.id] === e.updatedAt || !got.has(e.id)) versions[e.id] = old.versions[e.id];
          }
          if (!full && !(keep.has(e.id) && old.versions[e.id] === e.updatedAt)) missing++;
        }
        const bank = await api<{ mcqs: Mcq[] }>('/api/content?mcqs=1', { auth: false }).catch(() => null);
        update(() => ({
          published: {
            // Some booklets failed to download: keep the old date so the next sync tries them again.
            updatedAt: missing ? old.updatedAt : index.updatedAt,
            booklets,
            extraMcqs: booklets.flatMap((b) => extras.get(b.id) ?? []),
            bankMcqs: bank?.mcqs ?? old.bankMcqs,
            versions,
          },
        }));
      }
    } finally {
      syncing.current = false;
    }
  }, [update]);

  // Sync on start, when the app comes back to the foreground, and every 3 minutes while open.
  useEffect(() => {
    if (!ready) return;
    void sync();
    const iv = setInterval(() => void sync(), 180_000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && void sync());
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [ready, sync, state.session?.refresh]);

  // Keep the shared content arrays in sync with the student's uploads before children render.
  const { allBooklets, allExtra } = useMemo(() => {
    const localIds = new Set(state.importedBooklets.map((b) => b.id));
    const pub = state.published.booklets.filter((b) => !localIds.has(b.id));
    const seen = new Set<string>();
    const extra = [...state.extraMcqs, ...state.published.extraMcqs, ...state.published.bankMcqs].filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
    return { allBooklets: [...state.importedBooklets, ...pub], allExtra: extra };
  }, [state.importedBooklets, state.extraMcqs, state.published]);

  // Keep the shared content arrays in sync before children render.
  const contentVersion = useMemo(() => {
    setImportedContent(allBooklets, allExtra, state.hiddenBooklets, state.catalog);
    setUniversity(state.universityId);
    return allBooklets.reduce((n, b) => n + (b.updatedAt ?? b.createdAt) % 100000, allBooklets.length * 7 + allExtra.length + state.hiddenBooklets.length * 131 + JSON.stringify(state.catalog).length * 17 + (state.universityId?.length ?? 0) * 7919);
  }, [allBooklets, allExtra, state.hiddenBooklets, state.catalog, state.universityId]);

  const isDark = state.appearance === 'dark' || (state.appearance === 'system' && scheme === 'dark');

  const acc = state.account;
  const isAdmin = acc?.kind === 'admin';
  const isStaff = isAdmin || acc?.kind === 'staff';
  const can = (perm: Account['perms'][number]) => !!acc && (isAdmin || (acc.kind === 'staff' && acc.perms.includes(perm)));
  const canUpload = can('content');
  const premium = isStaff || acc?.plan === 'premium';

  const value = useMemo<Store>(
    () => ({
      ...state,
      // The profile now comes from the signed-in account (null = show the sign-in screen).
      profile: acc ? { name: acc.name, email: acc.email, stageId: acc.stageId as StageId } : null,
      role: canUpload ? 'admin' : premium ? 'premium' : 'pro',
      unlockedSubjects: subjects.filter((x) => isStaff || x.id === 'uploads' || PLAN_RANK[accessOf(x.id, x.isFree, state.subjectAccess)] <= PLAN_RANK[acc?.plan ?? 'free']).map((x) => x.id),
      isStaff,
      isAdmin,
      can,
      findBooklet: (id) => allBooklets.find((b) => b.id === id),
      signIn: async (email, password) => {
        const r = await api<{ session: Session; account: Account }>('/api/auth', { body: { action: 'login', email, password }, auth: false });
        setSession(r.session);
        update(() => ({ session: r.session, account: r.account }));
        setTimeout(() => void sync(), 50);
      },
      signUp: async (p) => {
        const r = await api<{ session: Session; account: Account }>('/api/auth', { body: { action: 'signup', ...p }, auth: false });
        setSession(r.session);
        update(() => ({ session: r.session, account: r.account, universityId: p.universityId ?? null }));
        setTimeout(() => void sync(), 50);
      },
      sync,
      setAccount: (a, session) => {
        if (session) setSession(session);
        update(() => (session ? { account: a, session } : { account: a }));
      },
      setMyRequest: (r) => update(() => ({ myRequest: r })),
      chooseUniversity: (id) => {
        update(() => ({ universityId: id }));
        if (getSession()) void api('/api/me', { method: 'PATCH', body: { universityId: id ?? '' } }).catch(() => {});
      },
      markPublished: (b) =>
        update((s) => ({
          importedBooklets: s.importedBooklets.map((x) => (x.id === b.id ? b : x)),
          publishedMeta: { ...s.publishedMeta, [b.id]: b.updatedAt ?? 0 },
        })),
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
      // Editing a published booklet on another device starts a local copy of it.
      updateImported: (b) =>
        update((s) => {
          const nb = { ...b, updatedAt: Date.now() };
          return { importedBooklets: s.importedBooklets.some((x) => x.id === b.id) ? s.importedBooklets.map((x) => (x.id === b.id ? nb : x)) : [nb, ...s.importedBooklets] };
        }),
      removeImported: (id) => {
        deleteBookletImages(id);
        update((s) => ({
          importedBooklets: s.importedBooklets.filter((x) => x.id !== id),
          favoriteBooklets: s.favoriteBooklets.filter((x) => x !== id),
          lastRead: s.lastRead?.topicId.startsWith(`${id}--`) ? null : s.lastRead,
        }));
      },
      addMark: (topicId, m) => update((s) => ({ marks: { ...s.marks, [topicId]: [...(s.marks[topicId] ?? []), m] } })),
      updateMark: (topicId, id, patch) =>
        update((s) => ({ marks: { ...s.marks, [topicId]: (s.marks[topicId] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) } })),
      removeMark: (topicId, id) => update((s) => ({ marks: { ...s.marks, [topicId]: (s.marks[topicId] ?? []).filter((m) => m.id !== id) } })),
      setDrawing: (topicId, strokes) => update((s) => ({ drawings: { ...s.drawings, [topicId]: strokes } })),
      setReaderPrefs: (patch) => update((s) => ({ readerPrefs: { ...s.readerPrefs, ...patch } })),
      addExtraMcqs: (list) => update((s) => ({ extraMcqs: [...s.extraMcqs, ...list] })),
      canEdit: premium,
      canUpload,
      canAddFiles: premium,
      streak: computeStreak(state.studyDays),
      contentVersion,
      logOut: () => {
        setSession(null);
        // Personal files and published content stay on the device; account data is cleared.
        setState({ ...DEFAULTS, appearance: state.appearance, language: state.language, importedBooklets: state.importedBooklets, extraMcqs: state.extraMcqs, published: state.published, publishedMeta: state.publishedMeta });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, ready, isDark, update, contentVersion, allBooklets, sync],
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
