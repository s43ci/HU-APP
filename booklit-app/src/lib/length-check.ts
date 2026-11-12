/**
 * Measures a converted booklet against its source, with no AI: how many words it kept, and how much of
 * the source's information it kept ("coverage": the share of the source's terms and numbers that appear
 * in the booklet). Used by the server and by the app (pure functions, no platform code).
 */

export const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** The words the booklet should have, for a source of `source` words shortened by `shorten` %. */
export const targetWords = (source: number, shorten: number) => Math.round(source * (1 - shorten / 100));

// Long but common words that carry no information of their own (ignored by the coverage).
const COMMON = new Set(
  `about above across action actual actually additional after again against almost already although always amount another answer anyone anything appear appears approach around associated available because become becomes before behind being believe below beside besides better between beyond called cannot caused causes certain change changes clearly common commonly compared complete consider considered contain contains continue could course currently degree depend depends describe described different directly during either enough entire especially example except expected explain fairly figure finally follow followed following former further general generally given giving greater having helps however important include included includes including increase increases indeed instead itself latter likely little making matter mainly mostly nearly necessary needed neither normal normally number occur occurs often others otherwise overall particular particularly people perhaps placed possible present presents pretty previous probably produce produced produces provide provided rather really reason recent recently regarding related relatively remain remains result results second section seems seen should similar simple simply single slightly something sometimes specific still strong strongly studies subject suggest suggests summary therefore things though through throughout together toward towards typical typically under unless unlike until usually various versus whereas whether which whilst within without would lecture slides chapter introduction`.split(' '),
);

/** The information-carrying words of a text: numbers and words of 6+ letters, without the common ones. */
export function terms(text: string): Set<string> {
  const out = new Set<string>();
  const words = text.replace(/\*\*/g, '').normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
  for (const word of words) {
    const acronym = /^[A-Z]{2,6}s?$/.test(word); // OKC, WHO, NSAIDs: short but important
    const w = word.toLowerCase().replace(/[.'’-]+$/, '').replace(/^(وال|بال|فال|كال|لل|ال)/, '');
    if (/\d/.test(w) || acronym || (w.length >= 6 && !COMMON.has(w))) out.add(w);
  }
  return out;
}

const root = (w: string) => (/\d/.test(w) ? w : w.slice(0, 6));

/** All the text of a booklet's blocks (questions not counted). */
export function bookletText(b: { topics: { title: string; blocks: unknown[] }[] }) {
  const parts: string[] = [];
  for (const t of b.topics) {
    parts.push(t.title);
    for (const blk of t.blocks as { text?: string; title?: string; items?: string[]; headers?: string[]; rows?: string[][]; caption?: string }[])
      parts.push(blk.text ?? '', blk.title ?? '', blk.caption ?? '', ...(blk.items ?? []), ...(blk.headers ?? []), ...(blk.rows ?? []).flat());
  }
  return parts.join(' ').replace(/\*\*/g, '');
}

export type LengthCheck = {
  sourceWords: number;
  outputWords: number;
  targetWords: number;
  shorten: number;
  /** How much shorter than the source, in % of words. */
  actualPct: number;
  /** Share (%) of the source's terms and numbers found in the booklet; null when the source text is not known. */
  coverage: number | null;
  /** Source terms not found in the booklet (a sample). */
  missing: string[];
  ok: boolean;
  retried: boolean;
  /** Sentences of the source added back word for word (no shortening only). */
  restored?: number;
};

/**
 * ok: with no shortening, at least 92% of the source's information is kept; with shortening, the word
 * count is within ±8 points of the asked %.
 */
export function measureBooklet(
  b: { topics: { title: string; blocks: unknown[] }[] },
  source: { words: number | null; text?: string | null },
  shorten: number,
): LengthCheck | null {
  const sourceWords = source.words ?? (source.text ? countWords(source.text) : 0);
  if (!sourceWords || sourceWords < 80) return null;
  const text = bookletText(b);
  const outputWords = countWords(text);
  const actualPct = Math.round((1 - outputWords / sourceWords) * 100);
  let coverage: number | null = null;
  let missing: string[] = [];
  if (source.text) {
    const src = terms(source.text);
    // Same root counts as present (radiographically ~ radiograph, enlarge ~ enlarging): first 6 letters.
    const roots = new Set([...terms(text)].map(root));
    missing = [...src].filter((w) => !roots.has(root(w)));
    coverage = src.size ? Math.round((100 * (src.size - missing.length)) / src.size) : null;
  }
  const ok = shorten <= 0 ? (coverage !== null ? coverage >= 92 : actualPct <= 15) : Math.abs(actualPct - shorten) <= 8;
  return { sourceWords, outputWords, targetWords: targetWords(sourceWords, shorten), shorten, actualPct, coverage, missing: missing.slice(0, 120), ok, retried: false };
}

/** Extra instructions for a second attempt, built from what the first attempt got wrong. */
export function retryNote(m: LengthCheck): { note: string; askWords?: number } {
  if (m.shorten <= 0) {
    const miss = m.missing.slice(0, 80);
    return {
      note:
        `\nIMPORTANT — SECOND ATTEMPT: the first attempt dropped information (it had ${m.outputWords.toLocaleString('en-US')} words for a source of ${m.sourceWords.toLocaleString('en-US')}).` +
        (miss.length ? ` These words of the source were missing: ${miss.join(', ')}. Every sentence that contains them must be in the new booklet.` : '') +
        ' Keep the source wording (you may split long sentences and turn them into points, but do not compress them into short notes). Leave nothing out.',
    };
  }
  // The AI misjudges length steadily, so ask for more (or fewer) words in proportion to its miss.
  const ratio = m.outputWords > 0 ? m.targetWords / m.outputWords : 2;
  const askWords = Math.min(m.sourceWords, Math.round(m.targetWords * Math.min(2.5, Math.max(0.6, ratio))));
  return {
    askWords,
    note: `\nIMPORTANT — SECOND ATTEMPT: the first attempt was ${m.outputWords < m.targetWords ? 'far too short' : 'too long'} (${m.outputWords.toLocaleString('en-US')} words). Keep about ${100 - m.shorten}% of every section — never reduce a section to one line. Write about ${askWords.toLocaleString('en-US')} words in the blocks, spread across all topics in proportion to the source.`,
  };
}

/** Which of two attempts is better: more information kept (no shortening) or closer to the asked %. */
export function better(a: LengthCheck, b: LengthCheck) {
  if (a.shorten <= 0) return (b.coverage ?? 0) > (a.coverage ?? 0) || (b.coverage === a.coverage && b.outputWords > a.outputWords) ? b : a;
  return Math.abs(b.actualPct - b.shorten) < Math.abs(a.actualPct - a.shorten) ? b : a;
}

type Blk = { type: string; text?: string; page?: number } & Record<string, unknown>;

/**
 * The safety net, with no AI. Sentences of the source whose information is not in the booklet are added,
 * word for word, at the end of the topic that talks about the same things.
 * - No word budget (no shortening): every sentence that lost much of its information is added back.
 * - With a word budget (the AI shortened more than asked): the most informative missing sentences are
 *   added back until the budget is used, so the booklet reaches the asked length.
 * Returns how many sentences were added.
 */
export function restoreMissing(
  b: { language?: string; topics: { title: string; blocks: Blk[] }[] },
  pages: string[],
  budgetWords?: number,
): number {
  const roots = new Set([...terms(bookletText(b))].map(root));
  // Which topic covers a page (the one with most blocks on it; otherwise the nearest earlier one).
  const topicOfPage = (p: number) => {
    let best = -1;
    let bestN = 0;
    b.topics.forEach((t, i) => {
      const n = t.blocks.filter((x) => x.page === p).length;
      if (n > bestN) [best, bestN] = [i, n];
    });
    if (best >= 0) return best;
    let near = 0;
    b.topics.forEach((t, i) => {
      if (t.blocks.some((x) => (x.page ?? 0) > 0 && (x.page ?? 0) <= p)) near = i;
    });
    return near;
  };
  const topicRoots = b.topics.map((t) => new Set([...terms(bookletText({ topics: [t] }))].map(root)));
  // The topic that talks about the same things; a term found in few topics counts more; the page decides a tie.
  const topicFor = (own: string[], page: number) => {
    const pageTopic = topicOfPage(page);
    let ti = pageTopic;
    let best = 0;
    topicRoots.forEach((r, i) => {
      const n = own.reduce((sum, w) => sum + (r.has(w) ? 1 / topicRoots.filter((x) => x.has(w)).length : 0), 0);
      if (n > best || (n === best && n > 0 && i === pageTopic)) [ti, best] = [i, n];
    });
    return ti;
  };
  type Cand = { order: number; page: number; text: string; roots: string[]; words: number };
  const cands: Cand[] = [];
  pages.forEach((pageText, pi) => {
    for (const s of pageText.replace(/\s+/g, ' ').split(/(?<=[.!?؟؛])\s+(?=\S)/)) {
      const text = s.trim();
      const own = [...terms(text)].map(root);
      if (own.length >= 2) cands.push({ order: cands.length, page: pi + 1, text, roots: own, words: countWords(text) });
    }
  });
  const lostOf = (c: Cand) => c.roots.filter((w) => !roots.has(w)).length;
  const chosen: Cand[] = [];
  const take = (c: Cand) => {
    chosen.push(c);
    for (const w of c.roots) roots.add(w);
  };
  if (budgetWords === undefined) {
    for (const c of cands) {
      const lost = lostOf(c);
      if (lost >= 3 || (lost >= 2 && lost / c.roots.length >= 0.4)) take(c);
    }
  } else {
    let left = budgetWords;
    const pool = new Set(cands);
    while (left > 0) {
      let best: Cand | null = null;
      let bestScore = 0;
      for (const c of pool) {
        const lost = lostOf(c);
        // Most missing information per word; a sentence must bring at least 2 missing terms.
        const score = lost >= 2 ? lost / Math.max(8, c.words) : 0;
        if (score > bestScore && c.words <= left + 15) [best, bestScore] = [c, score];
      }
      if (!best) break;
      pool.delete(best);
      take(best);
      left -= best.words;
    }
  }
  // Placed in the order of the source.
  const add = new Map<number, string[]>();
  for (const c of chosen.sort((x, y) => x.order - y.order)) {
    const ti = topicFor(c.roots, c.page);
    add.set(ti, [...(add.get(ti) ?? []), c.text]);
  }
  const ar = /arab/i.test(b.language ?? '');
  for (const [ti, list] of add)
    b.topics[ti].blocks.push(
      { type: 'heading', text: ar ? 'تفاصيل إضافية من النص الأصلي' : 'Additional details from the original', page: 0 },
      ...list.map((text) => ({ type: 'paragraph', text, page: 0 })),
    );
  return chosen.length;
}
