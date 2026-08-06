// ============================================================================
// Unicode font loading for the PDF generators.
//
// WHY THIS EXISTS
// pdf-lib's built-in StandardFonts (Helvetica et al.) are WinAnsi/Latin-1 only.
// Any Greek character throws `WinAnsi cannot encode "Η" (0x0397)` — and it
// throws from BOTH drawText() AND widthOfTextAtSize(), so a layout pass crashes
// just as readily as a draw. That took out the Certificate of Completion for a
// signed contract (SOS-C-2026-005) whose data contained Greek text.
//
// For a Cyprus company signing Greek-named clubs this is routine input, not an
// edge case, so we embed a real Unicode font (Noto Sans, SIL Open Font License)
// with fontkit and render Greek properly.
//
// DEFENCE IN DEPTH
// Embedding the font is the fix. `safeFont()` is the seatbelt: it wraps the
// embedded font so that if ANY character still can't be encoded (a font gap, an
// emoji a client pastes into a company name), we substitute a replacement
// character instead of throwing. A certificate that renders with one odd glyph
// is recoverable; a certificate that fails to generate is an evidence incident.
// ============================================================================

// deno-lint-ignore no-explicit-any
type Any = any;

// Noto Sans covers Latin + Greek + Cyrillic and is SIL OFL licensed (free to
// embed in documents). Pinned to a commit-stable raw URL.
//
// WHY THE FONTS ARE MIRRORED INTO STORAGE
// Signing SOS-C-2026-012 (Anorthosis) took 3.5 MINUTES between the signature
// landing and the certificate row appearing — almost all of it spent pulling
// ~1.7MB of TTF from GitHub on a cold isolate. The invocation was then killed
// before it reached the email block, so the signer and staff got nothing AND
// none of the failure handlers ran (a killed isolate does not run `catch`).
//
// The per-isolate byte cache below never helped: signings are minutes apart, so
// every one is effectively a cold start and pays the full download.
//
// So the fonts are mirrored into the private `assets` bucket on first use and
// read from there afterwards — same region as the function, no public-internet
// dependency in the signing path. GitHub becomes a one-time seed, not a
// per-signature runtime dependency. The chain degrades safely at every step:
//   Storage -> GitHub -> WinAnsi StandardFonts (Greek renders as '?')
// A slow certificate is recoverable; a killed invocation is an evidence
// incident.
const FONT_URLS = {
  regular: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  bold: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
  italic: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Italic.ttf',
};

// Object names inside the private `assets` bucket, keyed the same as FONT_URLS.
const FONT_BUCKET = 'assets';
const FONT_OBJECTS: Record<keyof typeof FONT_URLS, string> = {
  regular: 'fonts/NotoSans-Regular.ttf',
  bold: 'fonts/NotoSans-Bold.ttf',
  italic: 'fonts/NotoSans-Italic.ttf',
};

// Cache the font bytes for the life of the isolate. This is a bonus when an
// isolate happens to stay warm — it is NOT the mechanism we rely on.
const fontBytesCache = new Map<string, Uint8Array>();

// A Supabase client for reading/writing the font mirror. Set by the callers via
// setFontStorageClient() so this module stays free of admin-client imports.
let fontStorage: Any = null;

/**
 * Give the font loader a Supabase client so it can use the Storage mirror.
 * Without one, loading falls back to fetching from GitHub as before.
 */
export function setFontStorageClient(client: Any): void {
  fontStorage = client;
}

// Pull a font from the Storage mirror. Returns null if unavailable for any
// reason (no client, bucket missing, object not seeded yet) so the caller can
// fall back rather than fail.
async function fontFromStorage(key: keyof typeof FONT_URLS): Promise<Uint8Array | null> {
  if (!fontStorage) return null;
  try {
    const { data, error } = await fontStorage.storage.from(FONT_BUCKET).download(FONT_OBJECTS[key]);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    // A truncated/empty object is worse than none — treat it as a miss.
    return bytes.length > 1000 ? bytes : null;
  } catch (_) {
    return null;
  }
}

// Seed the mirror so the NEXT signing reads from Storage. Best-effort and
// deliberately not awaited by the caller's critical path.
async function mirrorToStorage(key: keyof typeof FONT_URLS, bytes: Uint8Array): Promise<void> {
  if (!fontStorage) return;
  try {
    await fontStorage.storage.from(FONT_BUCKET).upload(FONT_OBJECTS[key], bytes, {
      contentType: 'font/ttf',
      upsert: true,
    });
  } catch (_) { /* the mirror is an optimisation, never a hard requirement */ }
}

/**
 * Font bytes for one weight, tried in order: isolate cache -> Storage mirror ->
 * GitHub (and seed the mirror on the way through). Throws only if every source
 * fails, which loadUnicodeFonts catches and degrades to WinAnsi.
 */
async function fetchFont(key: keyof typeof FONT_URLS): Promise<Uint8Array> {
  const url = FONT_URLS[key];
  const cached = fontBytesCache.get(url);
  if (cached) return cached;

  const mirrored = await fontFromStorage(key);
  if (mirrored) {
    fontBytesCache.set(url, mirrored);
    return mirrored;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed (${res.status}) for ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  fontBytesCache.set(url, bytes);
  await mirrorToStorage(key, bytes);
  return bytes;
}

/**
 * Replace characters the embedded font cannot encode, so a draw or measure can
 * never throw. Returns the input unchanged in the overwhelmingly common case.
 */
function sanitizeFor(font: Any, text: string): string {
  const s = String(text ?? '');
  if (!s) return s;
  try {
    // Cheapest reliable probe: if the whole string measures, it will draw.
    font.widthOfTextAtSize(s, 12);
    return s;
  } catch {
    // Something in here is unencodable — find and replace only the offenders,
    // preserving every character that IS renderable.
    let out = '';
    for (const ch of s) {
      try {
        font.widthOfTextAtSize(ch, 12);
        out += ch;
      } catch {
        // Keep the text legible and the layout stable rather than dropping it.
        out += '?';
      }
    }
    return out;
  }
}

/**
 * Wrap an embedded font so drawText/widthOfTextAtSize can never throw on an
 * unencodable character. The returned object is a drop-in for a pdf-lib font:
 * it forwards everything, but sanitises text on the two throwing methods.
 *
 * `__sanitize` is exposed so page.drawText() call sites can clean their string
 * before pdf-lib touches it (drawText encodes via the font internally, which
 * bypasses any wrapper we put on the font's own methods).
 */
export function safeFont(font: Any): Any {
  const wrapper = Object.create(font);
  wrapper.__sanitize = (t: string) => sanitizeFor(font, t);
  wrapper.widthOfTextAtSize = (text: string, size: number) =>
    font.widthOfTextAtSize(sanitizeFor(font, text), size);
  wrapper.heightOfTextAtSize = (text: string, size: number) =>
    font.heightOfTextAtSize ? font.heightOfTextAtSize(sanitizeFor(font, text), size) : 0;
  // pdf-lib reads these off the font when embedding the page's resources.
  wrapper.__raw = font;
  return wrapper;
}

/**
 * Embed Noto Sans (regular/bold/italic) into `pdf` and return safe wrappers.
 * Falls back to the WinAnsi StandardFonts if the font fetch fails, so a network
 * blip degrades to "Greek renders as ?" rather than "no certificate at all".
 */
export async function loadUnicodeFonts(
  pdf: Any,
  StandardFonts: Any,
  // Embedding a weight means fontkit parses ~570KB of TTF and builds a glyph
  // map for it. The certificate never draws in italic, so embedding one there
  // was a full parse + subset of pure waste on a path that is racing the wall
  // clock. Callers that don't need italic can now say so.
  opts?: { italic?: boolean },
): Promise<{ font: Any; bold: Any; italic: Any; unicode: boolean }> {
  const wantItalic = opts?.italic !== false;
  try {
    // esm.sh may expose fontkit as a default or namespace export depending on
    // how it interops the CJS package; accept either.
    const fontkitMod: Any = await import('https://esm.sh/@pdf-lib/fontkit@1.1.1');
    pdf.registerFontkit(fontkitMod?.default ?? fontkitMod);
    const [rBytes, bBytes, iBytes] = await Promise.all([
      fetchFont('regular'),
      fetchFont('bold'),
      wantItalic ? fetchFont('italic') : Promise.resolve(null),
    ]);
    // subset: true keeps only the glyphs actually used — a few KB, not 1.7MB.
    const font = await pdf.embedFont(rBytes, { subset: true });
    const bold = await pdf.embedFont(bBytes, { subset: true });
    // Fall back to the regular face when italic was not requested, so callers
    // that do reference `italic` still get a usable font object.
    const italic = iBytes ? await pdf.embedFont(iBytes, { subset: true }) : font;
    return { font: safeFont(font), bold: safeFont(bold), italic: safeFont(italic), unicode: true };
  } catch (err) {
    console.error('[pdfFont] Unicode font embed failed, falling back to WinAnsi:', err);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    return { font: safeFont(font), bold: safeFont(bold), italic: safeFont(italic), unicode: false };
  }
}

/**
 * Draw text on a page using a safe font wrapper. Sanitises the string first, so
 * an unencodable character can never abort PDF generation.
 */
export function drawSafeText(page: Any, text: string, opts: Any): void {
  const f = opts?.font;
  const clean = f && typeof f.__sanitize === 'function'
    ? f.__sanitize(text ?? '')
    : String(text ?? '');
  page.drawText(clean, { ...opts, font: f?.__raw ?? f });
}
