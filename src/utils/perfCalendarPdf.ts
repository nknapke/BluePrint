type PdfObjectRef = {
  body: string;
  bodyStart: number;
  rawStart: number;
  rawEnd: number;
};

type PdfTextItem = {
  x: number;
  y: number;
  text: string;
};

type ParsedDayLabel = {
  x: number;
  y: number;
  day: number;
  month: number;
};

type ParsedRow = {
  y: number;
  labels: ParsedDayLabel[];
};

export type ParsedShowCalendarDay = {
  dateISO: string;
  isDarkDay: boolean;
  showTimes: string[];
};

type ParsePerformanceCalendarPdfOptions = {
  onProgress?: (message: string) => void;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_ABBREVIATIONS = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const MONTH_TITLE_RE = new RegExp(
  `^(${MONTH_NAMES.join("|")})\\s+(\\d{4})$`
);
const DAY_LABEL_RE = /^(\d{1,2})-([A-Za-z]{3})$/;
const DARK_TEXT_RE = /^DARK(?: DAY)?$/i;
const TEXT_BLOCK_RE =
  /([-\d.]+)\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s+Tm\s+(\[(?:[\s\S]*?)\]TJ|\((?:\\.|[^\\)])*\)\s*Tj)/g;
const PDF_OBJECT_RE = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
const PAGE_OBJECT_RE = /\/Type\/Page(?!s)\b/;
const CONTENT_ARRAY_RE = /\/Contents\[([\s\S]*?)\]/;
const CONTENT_SINGLE_RE = /\/Contents\s+(\d+)\s+0\s+R/;
const DARK_DAY_SHOW_TIME = "23:59:00";
const DARK_DAY_SORT_ORDER = 999;

const STREAM_START_BYTES = [
  new Uint8Array([0x73, 0x74, 0x72, 0x65, 0x61, 0x6d, 0x0d, 0x0a]), // stream\r\n
  new Uint8Array([0x73, 0x74, 0x72, 0x65, 0x61, 0x6d, 0x0a]), // stream\n
  new Uint8Array([0x73, 0x74, 0x72, 0x65, 0x61, 0x6d, 0x0d]), // stream\r
];

function buildPdfObjects(rawText: string) {
  const objects = new Map<number, PdfObjectRef>();
  PDF_OBJECT_RE.lastIndex = 0;
  let match;
  while ((match = PDF_OBJECT_RE.exec(rawText))) {
    const fullMatch = match[0];
    const body = match[2];
    const bodyOffset = fullMatch.indexOf(body);
    if (bodyOffset < 0) continue;
    objects.set(Number(match[1]), {
      body,
      bodyStart: match.index + bodyOffset,
      rawStart: match.index,
      rawEnd: match.index + fullMatch.length,
    });
  }
  return objects;
}

function findByteSequenceIndex(
  source: Uint8Array,
  pattern: Uint8Array,
  fromIndex = 0
) {
  outer: for (let i = Math.max(0, fromIndex); i <= source.length - pattern.length; i += 1) {
    for (let j = 0; j < pattern.length; j += 1) {
      if (source[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}

async function inflatePdfStream(data: Uint8Array) {
  if (typeof DecompressionStream !== "function") {
    throw new Error(
      "PDF import requires a browser with DecompressionStream support."
    );
  }
  try {
    const compressedStream = new Blob([data]).stream();
    const buffer = await new Response(
      compressedStream.pipeThrough(new DecompressionStream("deflate"))
    ).arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : String(error || "");
    throw new Error(
      message === "Failed to fetch"
        ? "The browser could not decompress this PDF stream."
        : `The browser could not decompress this PDF stream: ${message}`
    );
  }
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function decodeLatin1(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

async function extractObjectStreamBytes(
  obj: PdfObjectRef,
  rawBytes: Uint8Array
) {
  const objectBytes = rawBytes.slice(obj.rawStart, obj.rawEnd);
  let streamStart = -1;
  let markerLength = 0;
  for (const marker of STREAM_START_BYTES) {
    const found = findByteSequenceIndex(objectBytes, marker);
    if (found >= 0) {
      streamStart = found + marker.length;
      markerLength = marker.length;
      break;
    }
  }
  if (streamStart < 0) return null;

  const lengthMatch = obj.body.match(/\/Length\s+(\d+)\b/);
  const declaredLength = lengthMatch ? Number(lengthMatch[1]) : null;

  let data: Uint8Array;
  if (Number.isFinite(declaredLength) && declaredLength! >= 0) {
    data = objectBytes.slice(streamStart, streamStart + Number(declaredLength));
  } else {
    const endMarker = new Uint8Array([
      0x0a, 0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d,
    ]); // \nendstream
    const fallbackEnd = findByteSequenceIndex(
      objectBytes,
      endMarker,
      streamStart - markerLength
    );
    if (fallbackEnd < 0) return null;
    data = objectBytes.slice(streamStart, fallbackEnd);
  }
  if (obj.body.includes("/FlateDecode")) {
    data = await inflatePdfStream(data);
  }
  return data;
}

function decodePdfLiteral(value: string) {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== "\\" || i + 1 >= value.length) {
      out.push(ch);
      continue;
    }
    const next = value[i + 1];
    const simple = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "(": "(",
      ")": ")",
      "\\": "\\",
    }[next];
    if (simple !== undefined) {
      out.push(simple);
      i += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      let digits = next;
      let consumed = 1;
      while (
        consumed < 3 &&
        i + 1 + consumed < value.length &&
        /[0-7]/.test(value[i + 1 + consumed])
      ) {
        digits += value[i + 1 + consumed];
        consumed += 1;
      }
      out.push(String.fromCharCode(parseInt(digits, 8)));
      i += consumed;
      continue;
    }
    out.push(next);
    i += 1;
  }
  return out.join("");
}

function decodePdfTextOperator(operator: string) {
  const trimmed = operator.trim();
  if (trimmed.endsWith("TJ")) {
    const parts: string[] = [];
    for (let i = 0; i < trimmed.length; i += 1) {
      if (trimmed[i] !== "(") continue;
      i += 1;
      const buffer: string[] = [];
      let depth = 1;
      while (i < trimmed.length && depth > 0) {
        const ch = trimmed[i];
        if (ch === "\\" && i + 1 < trimmed.length) {
          buffer.push(ch, trimmed[i + 1]);
          i += 2;
          continue;
        }
        if (ch === "(") {
          depth += 1;
        } else if (ch === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
        buffer.push(ch);
        i += 1;
      }
      parts.push(decodePdfLiteral(buffer.join("")));
    }
    return parts.join("");
  }
  const literalMatch = trimmed.match(/\(([\s\S]*)\)\s*Tj$/);
  if (!literalMatch) return "";
  return decodePdfLiteral(literalMatch[1]);
}

function extractPdfTextItems(content: string) {
  const items: PdfTextItem[] = [];
  TEXT_BLOCK_RE.lastIndex = 0;
  let match;
  while ((match = TEXT_BLOCK_RE.exec(content))) {
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const text = decodePdfTextOperator(match[4]).trim();
    if (!text) continue;
    items.push({ x, y, text });
  }
  return items;
}

function parsePageRows(items: PdfTextItem[]) {
  const labels = items
    .map((item) => {
      const match = item.text.match(DAY_LABEL_RE);
      if (!match) return null;
      const day = Number(match[1]);
      const month = MONTH_ABBREVIATIONS[
        match[2].trim().slice(0, 3).toUpperCase() as keyof typeof MONTH_ABBREVIATIONS
      ];
      if (!Number.isFinite(day) || !month) return null;
      return { x: item.x, y: item.y, day, month } satisfies ParsedDayLabel;
    })
    .filter(Boolean) as ParsedDayLabel[];

  labels.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const rows: ParsedRow[] = [];
  for (const label of labels) {
    const existing = rows.find((row) => Math.abs(row.y - label.y) <= 3);
    if (existing) {
      existing.labels.push(label);
      continue;
    }
    rows.push({ y: label.y, labels: [label] });
  }

  rows.sort((a, b) => b.y - a.y);
  rows.forEach((row) => row.labels.sort((a, b) => a.x - b.x));
  return rows;
}

function deriveCalendarYear(
  labelMonth: number,
  pageMonth: number,
  pageYear: number
) {
  const diff = labelMonth - pageMonth;
  if (diff >= 10) return pageYear - 1;
  if (diff <= -10) return pageYear + 1;
  return pageYear;
}

function normalizeTimeText(value: string) {
  const match = String(value || "")
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return `${hour}:${String(minute).padStart(2, "0")} ${match[3]}`;
}

function timeTextToMinutes(value: string) {
  const normalized = normalizeTimeText(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  if (match[3] === "PM") hour += 12;
  return hour * 60 + minute;
}

export function timeTextToSqlTime(value: string) {
  const minutes = timeTextToMinutes(value);
  if (minutes == null) return null;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function getDarkDayShowPayload(dateISO: string, locationId: number) {
  return {
    location_id: Number(locationId),
    show_date: dateISO,
    show_time: DARK_DAY_SHOW_TIME,
    sort_order: DARK_DAY_SORT_ORDER,
  };
}

export async function parsePerformanceCalendarPdf(
  file: File,
  options: ParsePerformanceCalendarPdfOptions = {}
) {
  const { onProgress } = options;
  onProgress?.("Reading performance calendar PDF...");
  const rawBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(rawBuffer);
  const rawText = decodeLatin1(rawBytes);
  await yieldToBrowser();
  onProgress?.("Indexing PDF structure...");
  const objects = buildPdfObjects(rawText);
  const pageObjectIds = Array.from(objects.entries())
    .filter(([, obj]) => PAGE_OBJECT_RE.test(obj.body))
    .map(([id]) => id)
    .sort((a, b) => a - b);

  const pageYears = new Map<number, number>();
  const parsedDays = new Map<string, { isDarkDay: boolean; showTimes: Set<string> }>();

  for (let pageIndex = 0; pageIndex < pageObjectIds.length; pageIndex += 1) {
    const pageId = pageObjectIds[pageIndex];
    const page = objects.get(pageId);
    if (!page) continue;
    onProgress?.(
      `Parsing calendar page ${pageIndex + 1} of ${pageObjectIds.length}...`
    );

    const arrayMatch = page.body.match(CONTENT_ARRAY_RE);
    const contentRefs = arrayMatch
      ? Array.from(arrayMatch[1].matchAll(/(\d+)\s+0\s+R/g)).map((m) => Number(m[1]))
      : (() => {
          const singleMatch = page.body.match(CONTENT_SINGLE_RE);
          return singleMatch ? [Number(singleMatch[1])] : [];
        })();

    const items: PdfTextItem[] = [];
    for (const ref of contentRefs) {
      const obj = objects.get(ref);
      if (!obj) continue;
      const streamBytes = await extractObjectStreamBytes(obj, rawBytes);
      if (!streamBytes) continue;
      items.push(...extractPdfTextItems(decodeLatin1(streamBytes)));
    }

    const titleItem = items.find((item) => MONTH_TITLE_RE.test(item.text));
    if (!titleItem) continue;
    const titleMatch = titleItem.text.match(MONTH_TITLE_RE);
    if (!titleMatch) continue;

    const pageMonth = MONTH_NAMES.indexOf(titleMatch[1]) + 1;
    const pageYear = Number(titleMatch[2]);
    if (!pageMonth || !Number.isFinite(pageYear)) continue;
    pageYears.set(pageId, pageYear);

    const rows = parsePageRows(items);
    const footerCutoffY = Math.max(65, titleItem.y + 20);

    rows.forEach((row, rowIndex) => {
      const nextRowY = rowIndex + 1 < rows.length ? rows[rowIndex + 1].y : footerCutoffY;
      const labelXs = row.labels.map((label) => label.x);

      const bands = row.labels.map((label, labelIndex) => ({
        label,
        left:
          labelIndex === 0
            ? Number.NEGATIVE_INFINITY
            : (labelXs[labelIndex - 1] + labelXs[labelIndex]) / 2,
        right:
          labelIndex === labelXs.length - 1
            ? Number.POSITIVE_INFINITY
            : (labelXs[labelIndex] + labelXs[labelIndex + 1]) / 2,
      }));

      items.forEach((item) => {
        if (!(item.y < row.y && item.y > nextRowY)) return;
        const normalizedTime = normalizeTimeText(item.text);
        const isDark = DARK_TEXT_RE.test(item.text);
        if (!normalizedTime && !isDark) return;

        const band = bands.find((candidate) => item.x > candidate.left && item.x <= candidate.right);
        if (!band) return;

        const calendarYear = deriveCalendarYear(
          band.label.month,
          pageMonth,
          pageYear
        );
        const dateISO = `${calendarYear}-${String(band.label.month).padStart(2, "0")}-${String(
          band.label.day
        ).padStart(2, "0")}`;

        if (!parsedDays.has(dateISO)) {
          parsedDays.set(dateISO, { isDarkDay: false, showTimes: new Set<string>() });
        }
        const entry = parsedDays.get(dateISO);
        if (!entry) return;
        if (isDark) {
          entry.isDarkDay = true;
          entry.showTimes.clear();
          return;
        }
        if (!entry.isDarkDay && normalizedTime) {
          entry.showTimes.add(normalizedTime);
        }
      });
    });
    await yieldToBrowser();
  }

  onProgress?.("Finalizing imported show calendar...");
  const mainYear = Array.from(pageYears.values()).reduce(
    (best, year, _, allYears) => {
      const currentCount = allYears.filter((value) => value === year).length;
      const bestCount = allYears.filter((value) => value === best).length;
      return currentCount > bestCount ? year : best;
    },
    Array.from(pageYears.values())[0] || new Date().getFullYear()
  );

  const result = Array.from(parsedDays.entries())
    .filter(([dateISO, value]) => {
      return (
        String(dateISO).startsWith(`${mainYear}-`) &&
        (value.isDarkDay || value.showTimes.size > 0)
      );
    })
    .map(([dateISO, value]) => {
      const showTimes = Array.from(value.showTimes).sort((a, b) => {
        const aMinutes = timeTextToMinutes(a) ?? 0;
        const bMinutes = timeTextToMinutes(b) ?? 0;
        return aMinutes - bMinutes;
      });
      return {
        dateISO,
        isDarkDay: value.isDarkDay,
        showTimes,
      } satisfies ParsedShowCalendarDay;
    })
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  return result;
}
