/**
 * Android "Open with Booklit" for PDFs: the system hands us a content:// or file:// URI.
 * Send it to the import screen instead of trying to treat it as a route.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^(content|file):\/\//i.test(path)) return `/import?sharedUri=${encodeURIComponent(path)}`;
  } catch {}
  return path;
}
