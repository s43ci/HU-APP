/**
 * In-app error log. Keeps the last 200 events on the device so the student can
 * share them (Profile → Error log) when something goes wrong.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export type LogLevel = 'error' | 'warn' | 'info';
export type LogEntry = { id: string; at: number; level: LogLevel; area: string; message: string; details?: Record<string, unknown> };

const KEY = 'booklit.log.v1';
const MAX = 200;
let entries: LogEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) entries = [...entries, ...(JSON.parse(raw) as LogEntry[])].slice(0, MAX);
  } catch {
    // storage unavailable: keep the in-memory log only
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
  }, 400);
  listeners.forEach((l) => l());
}

export function log(level: LogLevel, area: string, message: string, details?: Record<string, unknown>) {
  const entry: LogEntry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), level, area, message: String(message).slice(0, 2000), details };
  entries = [entry, ...entries].slice(0, MAX);
  load().then(persist);
  if (__DEV__) console.log(`[${level}] ${area}: ${message}`, details ?? '');
}

export const logError = (area: string, error: unknown, details?: Record<string, unknown>) => {
  const e = error as { message?: string; name?: string; stack?: string };
  log('error', area, e?.message ?? String(error), { ...details, name: e?.name, stack: e?.stack?.split('\n').slice(0, 6).join('\n') });
};

export async function getLog() {
  await load();
  return entries;
}

export function subscribeLog(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function clearLog() {
  entries = [];
  await AsyncStorage.removeItem(KEY).catch(() => {});
  listeners.forEach((l) => l());
}

export function deviceInfo() {
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    app: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'web',
    build: Application.nativeBuildVersion ?? '-',
    runtime: Updates.runtimeVersion ?? '-',
    update: Updates.updateId ?? 'embedded',
    channel: Updates.channel ?? '-',
    expoGo: Constants.executionEnvironment === 'storeClient',
  };
}

/** Plain-text report that can be pasted into a chat. */
export async function formatReport() {
  const list = await getLog();
  const d = deviceInfo();
  const head = [
    'BOOKLIT error log',
    `Generated: ${new Date().toISOString()}`,
    `Device: ${d.platform} ${d.osVersion} · app ${d.app} (${d.build}) · ${d.expoGo ? 'Expo Go' : 'standalone'}`,
    `Update: ${d.update} · runtime ${d.runtime} · channel ${d.channel}`,
    `Entries: ${list.length}`,
    '',
  ];
  const body = list.map((e) => {
    const time = new Date(e.at).toISOString().replace('T', ' ').slice(0, 19);
    const det = e.details ? `\n    ${JSON.stringify(e.details).slice(0, 1500)}` : '';
    return `[${time}] ${e.level.toUpperCase()} ${e.area}: ${e.message}${det}`;
  });
  return [...head, ...body].join('\n');
}

let installed = false;
/** Capture uncaught JS errors and unhandled promise rejections. */
export function installGlobalHandlers() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void };
    addEventListener?: (type: string, fn: (ev: { reason?: unknown; error?: unknown; message?: string }) => void) => void;
  };
  // On web, lazily loaded screens make Metro report "Requiring unknown module" once
  // before the chunk arrives; the router recovers by itself, so it is not logged.
  const benign = (e: unknown) => Platform.OS === 'web' && /Requiring unknown module/.test(String((e as Error)?.message ?? e));
  if (g.ErrorUtils) {
    const prev = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((e, fatal) => {
      if (!benign(e)) logError(fatal ? 'crash' : 'js', e, { fatal: !!fatal });
      prev(e, fatal);
    });
  }
  if (Platform.OS === 'web' && g.addEventListener) {
    g.addEventListener('error', (ev) => !benign(ev.error ?? ev.message) && logError('js', ev.error ?? ev.message));
    g.addEventListener('unhandledrejection', (ev) => logError('promise', ev.reason));
  }
}
