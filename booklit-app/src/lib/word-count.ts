/**
 * Read the text of a PDF on the device (no AI), page by page, so the app can check that the booklet kept
 * the source's information and length (src/lib/length-check.ts). Returns undefined when the PDF has no
 * text layer (scanned pages) or the reader is not available on this device; the check is then skipped.
 */
export async function pdfText(bytes: Uint8Array): Promise<{ text: string; pages: string[] } | undefined> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes)); // a copy: pdf.js may take ownership of the buffer
    const { text: pages } = await extractText(pdf, { mergePages: false });
    const text = pages.join('\n');
    return text.trim() ? { text, pages } : undefined;
  } catch {
    return undefined;
  }
}
