import { t } from '@/i18n';
import { bookletsOf, getSubject, topicsOf, topicsOfSubject } from '@/data/content';

export function isSubjectUnlocked(subjectId: string, unlocked: string[]) {
  const s = getSubject(subjectId);
  return !!s && (s.isFree || unlocked.includes(subjectId));
}

export function subjectProgress(subjectId: string, completed: string[]) {
  const all = topicsOfSubject(subjectId);
  const done = all.filter((t) => completed.includes(t.id)).length;
  return { done, total: all.length, pct: all.length ? done / all.length : 0 };
}

export function bookletProgress(bookletId: string, completed: string[], partial: Record<string, number> = {}) {
  const all = topicsOf(bookletId);
  const done = all.filter((t) => completed.includes(t.id)).length;
  const weighted = all.reduce((n, t) => n + (completed.includes(t.id) ? 1 : (partial[t.id] ?? 0)), 0);
  return { done, total: all.length, pct: all.length ? weighted / all.length : 0 };
}

/** Booklets the student has started (at least one topic touched). */
export function startedBooklets(subjectIds: string[], completed: string[], partial: Record<string, number>) {
  return subjectIds.flatMap((sid) =>
    bookletsOf(sid).filter((b) => topicsOf(b.id).some((t) => completed.includes(t.id) || (partial[t.id] ?? 0) > 0)),
  );
}

export function formatStudyTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return t(h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening');
}

export function initials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
