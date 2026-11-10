import { handle, HttpError, json, newId, optionsHandler, putMedia, requirePerm } from '@/server/supa';
import { addMediaBytes } from '@/server/usage';

/** Upload one image of a booklet being published (raw bytes). Returns its public URL. */
export const OPTIONS = optionsHandler;

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

export const POST = handle(async (request) => {
  await requirePerm(request, 'content');
  const mime = (request.headers.get('content-type') || 'image/png').split(';')[0];
  if (!EXT[mime]) throw new HttpError(400, 'Only PNG, JPEG, WebP or GIF images.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) throw new HttpError(400, 'Empty image');
  if (bytes.length > 8 * 1024 * 1024) throw new HttpError(413, 'Image is too large (max 8 MB).');
  const folder = (request.headers.get('x-file-name') || 'booklet').replace(/[^\w-]/g, '').slice(0, 60) || 'booklet';
  const url = await putMedia(`${folder}/${newId()}.${EXT[mime]}`, bytes, mime);
  await addMediaBytes(bytes.length);
  return json({ url });
});
