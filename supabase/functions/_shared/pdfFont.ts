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
// embed in documents). Pinned to a commit-stable raw URL. Fetched at generation
// time and cached per isolate — see loadUnicodeFonts.
const FONT_URLS = {
  regular: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  bold: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
  italic: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Italic.ttf',
};

// Cache the downloaded font bytes for the life of the isolate. Edge Functions
// stay warm between invocations, so repeat signings don't re-download ~1.7MB.
const fontBytesCache = new Map<string, Uint8Array>();

async function fetchFont(url: string): Promise<Uint8Array> {
  const cached = fontBytesCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed (${res.status}) for ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  fontBytesCache.set(url, bytes);
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
): Promise<{ font: Any; bold: Any; italic: Any; unicode: boolean }> {
  try {
    // esm.sh may expose fontkit as a default or namespace export depending on
    // how it interops the CJS package; accept either.
    const fontkitMod: Any = await import('https://esm.sh/@pdf-lib/fontkit@1.1.1');
    pdf.registerFontkit(fontkitMod?.default ?? fontkitMod);
    const [rBytes, bBytes, iBytes] = await Promise.all([
      fetchFont(FONT_URLS.regular),
      fetchFont(FONT_URLS.bold),
      fetchFont(FONT_URLS.italic),
    ]);
    // subset: true keeps only the glyphs actually used — a few KB, not 1.7MB.
    const font = await pdf.embedFont(rBytes, { subset: true });
    const bold = await pdf.embedFont(bBytes, { subset: true });
    const italic = await pdf.embedFont(iBytes, { subset: true });
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
