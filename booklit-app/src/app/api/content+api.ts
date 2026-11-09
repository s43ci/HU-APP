import { getJson, handle, json, optionsHandler } from '@/server/supa';

/**
 * Published content for every student (no sign-in needed to read the list; it holds no personal data).
 * GET            → { updatedAt, booklets: [...index entries], mcqsUpdatedAt }
 * GET ?id=<id>   → { booklet, extraMcqs, updatedAt }
 * GET ?mcqs=1    → { mcqs, updatedAt }  (question-bank MCQs for built-in topics)
 */
export const OPTIONS = optionsHandler;

export const GET = handle(async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const data = await getJson(`content/booklets/${id.replace(/[^\w-]/g, '')}.json`, null);
    return data ? json(data) : json({ error: 'Not found' }, 404);
  }
  if (url.searchParams.get('mcqs')) return json(await getJson('content/mcqs.json', { updatedAt: 0, mcqs: [] }));
  const [index, access] = await Promise.all([getJson('content/index.json', { updatedAt: 0, booklets: [] }), getJson<Record<string, string>>('config/subjects.json', {})]);
  return json({ ...index, access });
});
