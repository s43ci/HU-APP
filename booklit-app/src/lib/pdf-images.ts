/**
 * Pull the embedded pictures out of a PDF (server side, pure JS).
 * - JPEG images (DCTDecode) are copied as-is.
 * - Flate-compressed RGB / grayscale / indexed images are re-wrapped as PNG.
 * Small icons, repeated logos and full-page scans are skipped.
 */
import { unzlibSync, zlibSync } from 'fflate';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, type PDFObject } from 'pdf-lib';

export type ExtractedImage = { page: number; mime: 'image/jpeg' | 'image/png'; data: Uint8Array; width: number; height: number };

const MAX_IMAGES = 30;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MIN_SIDE = 120;

export async function extractPdfImages(bytes: Uint8Array): Promise<ExtractedImage[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const N = (s: string) => PDFName.of(s);
  const resolve = (o: PDFObject | undefined) => (o instanceof PDFRef ? ctx.lookup(o) : o);

  type Found = { page: number; key: string; stream: PDFRawStream; pageAspect: number };
  const found: Found[] = [];
  const pagesPerKey = new Map<string, Set<number>>();

  doc.getPages().forEach((page, p) => {
    const { width: pw, height: ph } = page.getSize();
    const seen = new Set<string>();
    const walk = (resources: PDFObject | undefined, depth: number) => {
      const res = resolve(resources);
      if (!(res instanceof PDFDict)) return;
      const xobjects = resolve(res.get(N('XObject')));
      if (!(xobjects instanceof PDFDict)) return;
      for (const [, value] of xobjects.entries()) {
        const key = value instanceof PDFRef ? value.toString() : `inline-${p}-${found.length}`;
        const obj = resolve(value);
        if (!(obj instanceof PDFRawStream) || seen.has(key)) continue;
        seen.add(key);
        const subtype = obj.dict.get(N('Subtype'));
        if (subtype === N('Image')) {
          if (!pagesPerKey.has(key)) {
            pagesPerKey.set(key, new Set());
            found.push({ page: p + 1, key, stream: obj, pageAspect: pw / ph });
          }
          pagesPerKey.get(key)!.add(p + 1);
        } else if (subtype === N('Form') && depth < 3) {
          walk(obj.dict.get(N('Resources')), depth + 1);
        }
      }
    };
    walk(page.node.Resources(), 0);
  });

  const out: ExtractedImage[] = [];
  let total = 0;
  for (const f of found) {
    if (out.length >= MAX_IMAGES) break;
    // Let the screen update between pictures (this runs on the phone).
    await new Promise((r) => setTimeout(r, 0));
    // The same picture on 3+ pages is a logo / header decoration.
    if ((pagesPerKey.get(f.key)?.size ?? 0) >= 3) continue;
    try {
      const img = convert(f.stream, resolve, N);
      if (!img) continue;
      if (img.width < MIN_SIDE || img.height < MIN_SIDE) continue;
      // Full-page scans: the text is already read by the AI, so the page picture is not repeated.
      const aspect = img.width / img.height;
      if (img.width >= 1000 && Math.abs(aspect - f.pageAspect) / f.pageAspect < 0.04) continue;
      if (total + img.data.length > MAX_TOTAL_BYTES) break;
      total += img.data.length;
      out.push({ page: f.page, ...img });
    } catch {
      // unsupported or damaged image: skip it
    }
  }
  return out;
}

function convert(
  stream: PDFRawStream,
  resolve: (o: PDFObject | undefined) => PDFObject | undefined,
  N: (s: string) => PDFName,
): Omit<ExtractedImage, 'page'> | null {
  const d = stream.dict;
  const num = (k: string) => {
    const v = resolve(d.get(N(k)));
    return v instanceof PDFNumber ? v.asNumber() : 0;
  };
  const width = num('Width');
  const height = num('Height');
  if (!width || !height || width * height > 25_000_000) return null;
  if (d.get(N('ImageMask'))?.toString() === 'true') return null;

  const filterObj = resolve(d.get(N('Filter')));
  const filters = filterObj instanceof PDFArray ? filterObj.asArray().map((x) => resolve(x)?.toString()) : filterObj ? [filterObj.toString()] : [];
  const cs = resolve(d.get(N('ColorSpace')));

  // Colour model of the image.
  let colors = 0;
  let palette: Uint8Array | null = null;
  const base = (o: PDFObject | undefined): number => {
    const v = resolve(o);
    if (!v) return 0;
    const s = v.toString();
    if (s === '/DeviceRGB' || s === '/CalRGB') return 3;
    if (s === '/DeviceGray' || s === '/CalGray') return 1;
    if (s === '/DeviceCMYK') return 4;
    if (v instanceof PDFArray) {
      const kind = resolve(v.get(0))?.toString();
      if (kind === '/ICCBased') {
        const icc = resolve(v.get(1));
        const n = icc instanceof PDFRawStream ? resolve(icc.dict.get(N('N'))) : undefined;
        return n instanceof PDFNumber ? n.asNumber() : 3;
      }
      if (kind === '/CalRGB') return 3;
      if (kind === '/CalGray') return 1;
    }
    return 0;
  };
  if (cs instanceof PDFArray && resolve(cs.get(0))?.toString() === '/Indexed') {
    if (base(cs.get(1)) !== 3) return null;
    const lookup = resolve(cs.get(3));
    palette =
      lookup instanceof PDFString || lookup instanceof PDFHexString
        ? lookup.asBytes()
        : lookup instanceof PDFRawStream
          ? (lookup.dict.get(N('Filter'))?.toString() === '/FlateDecode' ? unzlibSync(lookup.contents) : lookup.contents)
          : null;
    if (!palette) return null;
    colors = 1;
  } else {
    colors = base(cs);
  }

  // JPEG: copy the stream directly (CMYK JPEGs render badly in apps, so skip them).
  if (filters.length === 1 && filters[0] === '/DCTDecode') {
    if (colors === 4) return null;
    return { mime: 'image/jpeg', data: stream.contents, width, height };
  }

  if (filters.length !== 1 || filters[0] !== '/FlateDecode') return null;
  if (colors !== 1 && colors !== 3) return null;
  const bpc = num('BitsPerComponent') || 8;
  if (bpc !== 8 && !(palette && (bpc === 1 || bpc === 2 || bpc === 4 || bpc === 8))) return null;

  const parms = resolve(d.get(N('DecodeParms')));
  const predictor = parms instanceof PDFDict ? (resolve(parms.get(N('Predictor'))) as PDFNumber | undefined)?.asNumber?.() ?? 1 : 1;

  const raw = unzlibSync(stream.contents);
  const rowBytes = Math.ceil((width * colors * bpc) / 8);
  let scanlines: Uint8Array;
  if (predictor >= 10) {
    // Already PNG-filtered rows (one filter byte per row): usable as PNG data directly.
    if (raw.length < (rowBytes + 1) * height) return null;
    scanlines = raw.subarray(0, (rowBytes + 1) * height);
  } else if (predictor <= 1) {
    if (raw.length < rowBytes * height) return null;
    scanlines = new Uint8Array((rowBytes + 1) * height);
    for (let y = 0; y < height; y++) scanlines.set(raw.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  } else {
    return null; // TIFF predictor: rare, not supported
  }

  const colorType = palette ? 3 : colors === 3 ? 2 : 0;
  return { mime: 'image/png', data: encodePng(width, height, palette ? bpc : 8, colorType, scanlines, palette), width, height };
}

// ---------- minimal PNG writer ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(parts: Uint8Array[]) {
  let c = 0xffffffff;
  for (const part of parts) for (let i = 0; i < part.length; i++) c = CRC_TABLE[(c ^ part[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  const t = new TextEncoder().encode(type);
  out.set(t, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32([t, data]));
  return out;
}

function encodePng(width: number, height: number, bitDepth: number, colorType: number, scanlines: Uint8Array, palette: Uint8Array | null) {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (palette) parts.push(chunk('PLTE', palette.subarray(0, Math.floor(palette.length / 3) * 3)));
  parts.push(chunk('IDAT', zlibSync(scanlines, { level: 6 })), chunk('IEND', new Uint8Array()));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
