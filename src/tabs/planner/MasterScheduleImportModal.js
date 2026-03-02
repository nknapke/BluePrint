import { useEffect, useMemo, useState } from "react";

const MODAL_BODY_STYLE = { maxHeight: "70vh", overflowY: "auto" };

const IGNORE_CODES = new Set([
  "OFF",
  "PTO",
  "WORKCALL",
  "WORK CALL",
  "WC",
  "WC/PRESETS",
  "WC/SHOWS",
  "REHEARSAL",
  "SHOWS",
  "TRAINING",
  "N/A",
  "NA",
  "#REF!",
  "#VALUE!",
  "OFFICE",
  "WAREHOUSE",
  "SHADOW",
  "VAC",
  "SICK",
  "HOLIDAY",
  "CALL",
  "FALSE",
  "TRUE",
  "IN",
  "OUT",
]);

const DAY_DESCRIPTION_MAP = new Map([
  ["OFF", "OFF"],
  ["PTO", "PTO"],
  ["VAC", "OFF"],
  ["SICK", "OFF"],
  ["HOLIDAY", "OFF"],
  ["WORKCALL", "Workcall"],
  ["WORK CALL", "Workcall"],
  ["CALL", "Workcall"],
  ["WC", "Workcall"],
  ["OFFICE", "Workcall"],
  ["WAREHOUSE", "Workcall"],
  ["SHADOW", "Workcall"],
  ["TRAINING", "Rehearsal"],
  ["WC/PRESETS", "WC/Presets"],
  ["WC PRESETS", "WC/Presets"],
  ["WCPRESETS", "WC/Presets"],
  ["WC/SHOWS", "WC/Shows"],
  ["WC SHOWS", "WC/Shows"],
  ["WCSHOWS", "WC/Shows"],
  ["REHEARSAL", "Rehearsal"],
  ["SHOWS", "Shows"],
  ["SHOW", "Shows"],
]);
const IMPORT_ALLOWED_DAY_DESCRIPTIONS = new Set(["OFF", "PTO", "Workcall"]);

const DAY_DESCRIPTION_NULLS = new Set([
  "N/A",
  "NA",
  "#REF!",
  "#VALUE!",
  "FALSE",
  "TRUE",
]);

function normalizeUpperToken(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeImportedDayDescription(value) {
  const token = normalizeUpperToken(value);
  if (!token) return null;
  if (DAY_DESCRIPTION_NULLS.has(token)) return null;
  if (!DAY_DESCRIPTION_MAP.has(token)) return null;
  const mapped = DAY_DESCRIPTION_MAP.get(token) || null;
  if (!mapped) return null;
  if (!IMPORT_ALLOWED_DAY_DESCRIPTIONS.has(mapped)) return null;
  return mapped;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (ch === "\r") continue;

    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function isDateLike(value) {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function isTimeLike(value) {
  if (!value) return false;
  const v = value.trim();
  return /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(v);
}

function isNumericLike(value) {
  if (!value) return false;
  const v = value.trim();
  return /^-?\d+(\.\d+)?$/.test(v);
}

function isHeaderName(value) {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  if (!v) return false;
  if (
    v.includes("MASTER SCHEDULE") ||
    v.includes("BMV CREW") ||
    v.startsWith("WEEK ") ||
    v === "REVISED" ||
    v === "DRAFT" ||
    v === "TOTAL HOURS"
  ) {
    return true;
  }
  return false;
}

function isLikelyCode(value) {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  const upper = v.toUpperCase();
  if (IGNORE_CODES.has(upper)) return false;
  if (isTimeLike(v)) return false;
  if (isNumericLike(v)) return false;
  return true;
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const min = Number(match[2]);
  const mer = match[3].toUpperCase();
  if (mer === "PM" && hour < 12) hour += 12;
  if (mer === "AM" && hour === 12) hour = 0;
  return hour * 60 + min;
}

function toSqlTime(value) {
  const mins = parseTimeToMinutes(value);
  if (mins == null) return null;
  const hour = Math.floor(mins / 60);
  const min = mins % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(
    2,
    "0"
  )}:00`;
}

function toISODate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function detectDateRow(rows) {
  let best = null;
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const row = rows[i] || [];
    let count = 0;
    for (const cell of row) {
      if (isDateLike(cell)) count += 1;
    }
    if (count >= 3) {
      best = i;
      break;
    }
  }
  return best;
}

function detectTimeRow(rows, dateRowIdx) {
  if (dateRowIdx == null) return null;
  for (let i = dateRowIdx + 1; i < Math.min(rows.length, dateRowIdx + 10); i += 1) {
    const row = rows[i] || [];
    let count = 0;
    for (const cell of row) {
      if (isTimeLike(cell)) count += 1;
    }
    if (count >= 3) return i;
  }
  return null;
}

function detectInOutRow(rows, timeRowIdx) {
  if (timeRowIdx == null) return null;
  for (
    let i = timeRowIdx + 1;
    i < Math.min(rows.length, timeRowIdx + 6);
    i += 1
  ) {
    const row = rows[i] || [];
    let labels = 0;
    for (const cell of row) {
      const token = normalizeUpperToken(cell);
      if (token === "IN" || token === "OUT") labels += 1;
    }
    if (labels >= 2) return i;
  }
  if (timeRowIdx + 1 < rows.length) return timeRowIdx + 1;
  return null;
}

function detectNameColumn(rows, dataStartRow) {
  if (dataStartRow == null) return 1;
  const sample = rows.slice(dataStartRow, dataStartRow + 8);
  if (!sample.length) return 1;
  const scores = new Map();
  sample.forEach((row) => {
    row.forEach((cell, idx) => {
      const v = (cell || "").trim();
      if (!v) return;
      if (isTimeLike(v)) return;
      if (isDateLike(v)) return;
      if (v.length < 2) return;
      const words = v.split(/\s+/).length;
      const score = scores.get(idx) || 0;
      scores.set(idx, score + words);
    });
  });
  let bestIdx = 1;
  let bestScore = -1;
  for (const [idx, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

function buildDayBlocks(rows, dateRowIdx, timeRowIdx, inOutRowIdx) {
  if (dateRowIdx == null || timeRowIdx == null) return [];
  const dateRow = rows[dateRowIdx] || [];
  const timeRow = rows[timeRowIdx] || [];
  const inOutRow = rows[inOutRowIdx] || [];
  const dateCols = [];
  dateRow.forEach((cell, idx) => {
    if (isDateLike(cell)) {
      dateCols.push({ idx, date: cell });
    }
  });

  const blocks = [];
  for (let i = 0; i < dateCols.length; i += 1) {
    const start = dateCols[i].idx;
    const end = i + 1 < dateCols.length ? dateCols[i + 1].idx - 1 : dateRow.length - 1;
    const dateISO = toISODate(dateCols[i].date);
    if (!dateISO) continue;

    const shows = [];
    for (let c = start; c <= end; c += 1) {
      const tVal = timeRow[c];
      if (!isTimeLike(tVal)) continue;
      const mins = parseTimeToMinutes(tVal);
      const sqlTime = toSqlTime(tVal);
      shows.push({
        col: c,
        timeRaw: tVal,
        time: sqlTime,
        mins,
      });
    }

    if (!shows.length) {
      let fallbackCol = null;
      for (let c = start; c <= end; c += 1) {
        if ((timeRow[c] || "").trim()) {
          fallbackCol = c;
          break;
        }
      }
      if (fallbackCol == null) fallbackCol = start;
      shows.push({
        col: fallbackCol,
        timeRaw: "",
        time: null,
        mins: null,
      });
    }

    shows.sort((a, b) => {
      if (a.mins == null && b.mins == null) return a.col - b.col;
      if (a.mins == null) return 1;
      if (b.mins == null) return -1;
      if (a.mins !== b.mins) return a.mins - b.mins;
      return a.col - b.col;
    });

    const normalizedShows = shows.map((s, idx) => ({
      ...s,
      sortOrder: idx + 1,
    }));

    const inCols = [];
    const outCols = [];
    for (let c = start; c <= end; c += 1) {
      const label = normalizeUpperToken(inOutRow[c]);
      if (label === "IN") inCols.push(c);
      if (label === "OUT") outCols.push(c);
    }
    if (!inCols.length && normalizedShows.length) {
      inCols.push(normalizedShows[0].col);
    }
    if (!outCols.length && normalizedShows.length) {
      outCols.push(normalizedShows[normalizedShows.length - 1].col);
    }

    const valueCols = [
      ...normalizedShows.map((s) => s.col),
      ...inCols,
      ...outCols,
    ].filter((v) => Number.isFinite(v));
    const valueStartCol = valueCols.length ? Math.min(...valueCols) : start;
    const valueEndCol = valueCols.length ? Math.max(...valueCols) : end;

    blocks.push({
      dateISO,
      startCol: start,
      endCol: end,
      valueStartCol,
      valueEndCol,
      inCols,
      outCols,
      shows: normalizedShows,
    });
  }
  return blocks;
}

function buildCrewBlocks(rows, dataStartRowIdx, nameColIdx) {
  if (dataStartRowIdx == null) return [];
  const blocks = [];
  let i = dataStartRowIdx;
  while (i < rows.length) {
    const row = rows[i] || [];
    const rawName = row[nameColIdx];
    const name = (rawName || "").trim();
    if (!name) {
      i += 1;
      continue;
    }
    if (isHeaderName(name)) {
      i += 1;
      continue;
    }
    const start = i;
    let end = i;
    let j = i + 1;
    while (j < rows.length) {
      const nextName = (rows[j]?.[nameColIdx] || "").trim();
      if (nextName) break;
      end = j;
      j += 1;
    }
    blocks.push({ name, start, end });
    i = j;
  }
  return blocks;
}

export default function MasterScheduleImportModal({
  S,
  open,
  onClose,
  onImported,
  locId,
  supabaseGet,
  supabasePost,
  supabaseDelete,
  tracks,
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState("");
  const [dateRowIdx, setDateRowIdx] = useState(null);
  const [timeRowIdx, setTimeRowIdx] = useState(null);
  const [inOutRowIdx, setInOutRowIdx] = useState(null);
  const [inOutTouched, setInOutTouched] = useState(false);
  const [dataStartRowIdx, setDataStartRowIdx] = useState(null);
  const [dataStartTouched, setDataStartTouched] = useState(false);
  const [nameColIdx, setNameColIdx] = useState(1);
  const [nameColTouched, setNameColTouched] = useState(false);
  const [codeMap, setCodeMap] = useState({});
  const [nameMap, setNameMap] = useState({});
  const [crewMap, setCrewMap] = useState(new Map());
  const [crewList, setCrewList] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState("");

  useEffect(() => {
    if (!open) return;
    setImportError("");
    setImportResult("");
  }, [open]);

  useEffect(() => {
    if (!locId || !open) return;
    let alive = true;
    (async () => {
      try {
        const crewRows = await supabaseGet(
          `/rest/v1/crew_roster?select=id,crew_name&location_id=eq.${Number(
            locId
          )}`
        );
        if (!alive) return;
        setCrewList(Array.isArray(crewRows) ? crewRows : []);
        const next = new Map();
        for (const c of crewRows || []) {
          const key = (c.crew_name || "").trim().toLowerCase();
          if (key) next.set(key, c.id);
        }
        setCrewMap(next);
      } catch (e) {
        if (!alive) return;
        setImportError(String(e?.message || e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [locId, open, supabaseGet]);

  const trackMap = useMemo(() => {
    const next = new Map();
    (tracks || []).forEach((t) => {
      const key = (t.track_name || t.name || "").trim().toLowerCase();
      if (key) next.set(key, t);
    });
    return next;
  }, [tracks]);

  const dayBlocks = useMemo(
    () => buildDayBlocks(rows, dateRowIdx, timeRowIdx, inOutRowIdx),
    [rows, dateRowIdx, timeRowIdx, inOutRowIdx]
  );

  const crewBlocks = useMemo(
    () => buildCrewBlocks(rows, dataStartRowIdx, nameColIdx),
    [rows, dataStartRowIdx, nameColIdx]
  );

  const crewExtract = useMemo(() => {
    if (!rows.length || dataStartRowIdx == null) return null;
    const assignments = [];
    const showInstances = new Map();
    const shiftEntries = new Map();
    const codesFound = new Set();
    const crewNames = new Set();
    const unknownCodes = new Set();
    const unknownCrew = new Set();
    const dateRange = { start: null, end: null };

    dayBlocks.forEach((b) => {
      if (!dateRange.start || b.dateISO < dateRange.start) dateRange.start = b.dateISO;
      if (!dateRange.end || b.dateISO > dateRange.end) dateRange.end = b.dateISO;
    });

    for (const b of dayBlocks) {
      const showList =
        Array.isArray(b.shows) && b.shows.length
          ? b.shows
          : [{ col: b.startCol, time: null, sortOrder: 1 }];
      showList.forEach((show, showIdx) => {
        const showTime = show.time;
        if (!showTime) return;
        const sortOrder = show.sortOrder || showIdx + 1;
        const showKey = `${b.dateISO}|${showTime}|${sortOrder}`;
        if (!showInstances.has(showKey)) {
          showInstances.set(showKey, {
            location_id: Number(locId),
            show_date: b.dateISO,
            show_time: showTime,
            sort_order: sortOrder,
          });
        }
      });
    }

    for (const block of crewBlocks) {
      const name = block.name;
      if (!name || name.toLowerCase().includes("total")) continue;
      crewNames.add(name);
      const key = name.toLowerCase();
      const mappedId = nameMap[key];
      const crewId = Number.isFinite(Number(mappedId))
        ? Number(mappedId)
        : crewMap.get(key);
      if (!crewId) {
        unknownCrew.add(name);
      }

      dayBlocks.forEach((b) => {
        const showList =
          Array.isArray(b.shows) && b.shows.length
            ? b.shows
            : [{ col: b.startCol, time: null, sortOrder: 1 }];

        const pickByMins = (items, mode) => {
          if (!items.length) return null;
          let best = items[0];
          for (let i = 1; i < items.length; i += 1) {
            const candidate = items[i];
            if (mode === "min" && candidate.mins < best.mins) best = candidate;
            if (mode === "max" && candidate.mins > best.mins) best = candidate;
          }
          return best.sqlTime;
        };

        const inCols = Array.isArray(b.inCols)
          ? b.inCols.filter((v) => Number.isFinite(v))
          : [];
        const outCols = Array.isArray(b.outCols)
          ? b.outCols.filter((v) => Number.isFinite(v))
          : [];
        const fallbackStartCol = Number.isFinite(b.valueStartCol) ? b.valueStartCol : b.startCol;
        const fallbackEndCol = Number.isFinite(b.valueEndCol) ? b.valueEndCol : b.endCol;

        let startTime = null;
        let endTime = null;
        const startCandidates = [];
        const endCandidates = [];

        for (let r = block.start; r <= block.end; r += 1) {
          const row = rows[r] || [];
          for (const col of inCols) {
            const raw = (row[col] || "").trim();
            if (!raw || !isTimeLike(raw)) continue;
            const mins = parseTimeToMinutes(raw);
            const sqlTime = toSqlTime(raw);
            if (mins == null || !sqlTime) continue;
            startCandidates.push({ mins, sqlTime });
          }
          for (const col of outCols) {
            const raw = (row[col] || "").trim();
            if (!raw || !isTimeLike(raw)) continue;
            const mins = parseTimeToMinutes(raw);
            const sqlTime = toSqlTime(raw);
            if (mins == null || !sqlTime) continue;
            endCandidates.push({ mins, sqlTime });
          }
        }

        startTime = pickByMins(startCandidates, "min");
        endTime = pickByMins(endCandidates, "max");

        if (!startTime || !endTime) {
          const allTimeCandidates = [];
          for (let r = block.start; r <= block.end; r += 1) {
            const row = rows[r] || [];
            for (let col = fallbackStartCol; col <= fallbackEndCol; col += 1) {
              const raw = (row[col] || "").trim();
              if (!raw || !isTimeLike(raw)) continue;
              const mins = parseTimeToMinutes(raw);
              const sqlTime = toSqlTime(raw);
              if (mins == null || !sqlTime) continue;
              allTimeCandidates.push({ mins, sqlTime });
            }
          }
          if (!startTime) startTime = pickByMins(allTimeCandidates, "min");
          if (!endTime && allTimeCandidates.length >= 2) {
            endTime = pickByMins(allTimeCandidates, "max");
          }
        }

        let dayDescription = null;
        for (let r = block.start; r <= block.end; r += 1) {
          const row = rows[r] || [];
          for (let col = fallbackStartCol; col <= fallbackEndCol; col += 1) {
            const raw = (row[col] || "").trim();
            if (!raw) continue;
            const normalized = normalizeImportedDayDescription(raw);
            if (!normalized) continue;
            dayDescription = normalized;
            break;
          }
          if (dayDescription) break;
        }

        if ((startTime || endTime || dayDescription) && crewId) {
          const shiftKey = `${b.dateISO}|${crewId}`;
          shiftEntries.set(shiftKey, {
            location_id: Number(locId),
            work_date: b.dateISO,
            crew_id: Number(crewId),
            start_time: startTime,
            end_time: endTime,
            day_description: dayDescription,
          });
        }

        showList.forEach((show, showIdx) => {
          const cols = [];
          const baseCol = Number.isFinite(show.col) ? show.col : b.startCol;
          cols.push(baseCol);
          // Only search this show column for a position code.

          let code = null;
          for (let r = block.start + 1; r <= block.end; r += 1) {
            const row = rows[r] || [];
            for (const col of cols) {
              const raw = (row[col] || "").trim();
              if (!raw) continue;
              if (!isLikelyCode(raw)) continue;
              code = raw.toUpperCase();
              break;
            }
            if (code) break;
          }

          if (!code) return;
          codesFound.add(code);
          const mappedTrack = codeMap[code];
          if (!mappedTrack) {
            unknownCodes.add(code);
            return;
          }
          if (!crewId) return;

          const showTime = show.time;
          if (!showTime) return;

          assignments.push({
            location_id: Number(locId),
            work_date: b.dateISO,
            crew_id: Number(crewId),
            is_working: true,
            track_id: Number(mappedTrack),
            show_time: showTime,
          });
        });
      });
    }

    return {
      assignments,
      showInstances,
      shiftEntries,
      codesFound,
      crewNames,
      unknownCodes,
      unknownCrew,
      dateRange,
    };
  }, [
    rows,
    dataStartRowIdx,
    dayBlocks,
    crewBlocks,
    crewMap,
    codeMap,
    nameMap,
    locId,
  ]);

  useEffect(() => {
    if (!rows.length) return;
    if (dateRowIdx != null && timeRowIdx != null && inOutRowIdx != null) return;
    const dRow = detectDateRow(rows);
    const tRow = detectTimeRow(rows, dRow);
    const ioRow = detectInOutRow(rows, tRow);
    if (dateRowIdx == null) setDateRowIdx(dRow);
    if (timeRowIdx == null) setTimeRowIdx(tRow);
    if (!inOutTouched) setInOutRowIdx(ioRow);
    const startRow = ioRow != null ? ioRow + 1 : tRow != null ? tRow + 2 : null;
    if (!dataStartTouched) setDataStartRowIdx(startRow);
    if (!nameColTouched) {
      const nameCol = detectNameColumn(rows, startRow);
      setNameColIdx(nameCol);
    }
  }, [
    rows,
    dateRowIdx,
    timeRowIdx,
    inOutRowIdx,
    inOutTouched,
    dataStartTouched,
    nameColTouched,
  ]);

  useEffect(() => {
    if (!rows.length) return;
    if (timeRowIdx == null) return;
    const autoInOutRow = detectInOutRow(rows, timeRowIdx);
    const effectiveInOutRow = inOutTouched ? inOutRowIdx : autoInOutRow;
    if (!inOutTouched) setInOutRowIdx(autoInOutRow);
    const startRow =
      effectiveInOutRow != null ? effectiveInOutRow + 1 : timeRowIdx + 2;
    if (!dataStartTouched) setDataStartRowIdx(startRow);
    if (!nameColTouched) {
      const nameCol = detectNameColumn(rows, startRow);
      setNameColIdx(nameCol);
    }
  }, [
    rows,
    timeRowIdx,
    inOutRowIdx,
    inOutTouched,
    nameColTouched,
    dataStartTouched,
  ]);

  useEffect(() => {
    if (!rows.length || !tracks?.length) return;
    if (!crewExtract?.codesFound?.size) return;
    const next = { ...codeMap };
    for (const code of crewExtract.codesFound) {
      if (next[code]) continue;
      const track = trackMap.get(code.toLowerCase());
      if (track?.id) next[code] = track.id;
    }
    setCodeMap(next);
  }, [crewExtract?.codesFound, rows.length, tracks, trackMap, codeMap]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportResult("");
    setParseError("");
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setFileName(file.name);
      setDateRowIdx(null);
      setTimeRowIdx(null);
      setInOutRowIdx(null);
      setDataStartRowIdx(null);
      setNameColIdx(1);
      setNameColTouched(false);
      setDataStartTouched(false);
      setInOutTouched(false);
      setCodeMap({});
      setNameMap({});
    } catch (err) {
      setParseError(String(err?.message || err));
    }
  };

  const handleMapChange = (code, value) => {
    setCodeMap((prev) => ({ ...prev, [code]: value ? Number(value) : null }));
  };

  const handleNameMapChange = (name, value) => {
    const key = name.toLowerCase();
    setNameMap((prev) => ({
      ...prev,
      [key]: value ? Number(value) : null,
    }));
  };

  const runImport = async () => {
    const shiftRows = crewExtract?.shiftEntries
      ? Array.from(crewExtract.shiftEntries.values())
      : [];
    if (!crewExtract || (!crewExtract.assignments.length && !shiftRows.length)) {
      setImportError("No assignments or shifts found to import.");
      return;
    }
    if (!crewExtract.showInstances || crewExtract.showInstances.size === 0) {
      setImportError("No show times found to import.");
      return;
    }
    if (!crewExtract.dateRange.start || !crewExtract.dateRange.end) {
      setImportError("Unable to determine date range from the file.");
      return;
    }
    setImportBusy(true);
    setImportError("");
    setImportResult("");

    try {
      await supabaseDelete(
        `/rest/v1/work_roster_assignments?location_id=eq.${Number(
          locId
        )}&work_date=gte.${crewExtract.dateRange.start}&work_date=lte.${
          crewExtract.dateRange.end
        }`
      );
      await supabaseDelete(
        `/rest/v1/show_instances?location_id=eq.${Number(
          locId
        )}&show_date=gte.${crewExtract.dateRange.start}&show_date=lte.${
          crewExtract.dateRange.end
        }`
      );
      await supabaseDelete(
        `/rest/v1/crew_work_shifts?location_id=eq.${Number(
          locId
        )}&work_date=gte.${crewExtract.dateRange.start}&work_date=lte.${
          crewExtract.dateRange.end
        }`
      );

      const showRows = Array.from(crewExtract.showInstances.values());
      const showChunkSize = 200;
      for (let i = 0; i < showRows.length; i += showChunkSize) {
        const slice = showRows.slice(i, i + showChunkSize);
        await supabasePost(
          "/rest/v1/show_instances?on_conflict=location_id,show_date,show_time",
          slice,
          { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
        );
      }

      const showLookup = await supabaseGet(
        `/rest/v1/show_instances?select=id,show_date,show_time` +
          `&location_id=eq.${Number(locId)}` +
          `&show_date=gte.${crewExtract.dateRange.start}` +
          `&show_date=lte.${crewExtract.dateRange.end}`,
        { bypassCache: true }
      );
      const showIdByKey = new Map();
      for (const row of Array.isArray(showLookup) ? showLookup : []) {
        const key = `${row.show_date}|${row.show_time}`;
        showIdByKey.set(key, row.id);
      }

      const assignments = crewExtract.assignments
        .map((a) => {
          const key = `${a.work_date}|${a.show_time}`;
          const showId = showIdByKey.get(key);
          if (!showId) return null;
          return {
            location_id: a.location_id,
            work_date: a.work_date,
            crew_id: a.crew_id,
            is_working: a.is_working,
            track_id: a.track_id,
            show_id: showId,
          };
        })
        .filter(Boolean);
      const chunkSize = 500;
      for (let i = 0; i < assignments.length; i += chunkSize) {
        const slice = assignments.slice(i, i + chunkSize);
        await supabasePost(
          "/rest/v1/work_roster_assignments?on_conflict=location_id,work_date,show_id,crew_id",
          slice,
          { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
        );
      }

      if (shiftRows.length) {
        const shiftChunk = 500;
        for (let i = 0; i < shiftRows.length; i += shiftChunk) {
          const slice = shiftRows.slice(i, i + shiftChunk);
          await supabasePost(
            "/rest/v1/crew_work_shifts?on_conflict=location_id,work_date,crew_id",
            slice,
            { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
          );
        }
      }

      const shiftsWithDescription = shiftRows.filter(
        (s) => String(s?.day_description || "").trim().length > 0
      ).length;
      setImportResult(
        `Imported ${showRows.length} shows, ${assignments.length} assignments, and ${shiftRows.length} shifts (${shiftsWithDescription} with day descriptions) for ${crewExtract.dateRange.start} to ${crewExtract.dateRange.end}.`
      );
      if (typeof onImported === "function") onImported();
    } catch (e) {
      setImportError(String(e?.message || e));
    } finally {
      setImportBusy(false);
    }
  };

  if (!open) return null;

  const previewRow = (idx) => {
    if (idx == null || !rows[idx]) return "—";
    return rows[idx].slice(0, 6).map((c) => c || " ").join(" | ");
  };

  return (
    <div style={S.modalOverlay} onMouseDown={onClose}>
      <div style={S.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Import Master Schedule</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Upload the master schedule CSV and map position codes to tracks.
            </div>
          </div>
          <button style={S.button("ghost")} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ ...S.modalBody, ...MODAL_BODY_STYLE }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <input type="file" accept=".csv" onChange={handleFileChange} />
              {fileName ? (
                <div style={{ ...S.helper, marginTop: 6 }}>{fileName}</div>
              ) : null}
              {parseError ? (
                <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
                  {parseError}
                </div>
              ) : null}
            </div>

            {rows.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={S.helper}>Detected rows</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Date row: {dateRowIdx != null ? dateRowIdx + 1 : "—"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {previewRow(dateRowIdx)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Time row: {timeRowIdx != null ? timeRowIdx + 1 : "—"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {previewRow(timeRowIdx)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    IN/OUT row: {inOutRowIdx != null ? inOutRowIdx + 1 : "—"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {previewRow(inOutRowIdx)}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ ...S.helper, marginBottom: 6 }}>
                        Date row
                      </div>
                      <select
                        style={{ ...S.select, width: "100%" }}
                        value={dateRowIdx ?? ""}
                        onChange={(e) =>
                          setDateRowIdx(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                      >
                        <option value="">Auto</option>
                        {rows.slice(0, 15).map((_, idx) => (
                          <option key={idx} value={idx}>
                            Row {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ minWidth: 140 }}>
                      <div style={{ ...S.helper, marginBottom: 6 }}>
                        IN/OUT row
                      </div>
                      <select
                        style={{ ...S.select, width: "100%" }}
                        value={inOutRowIdx ?? ""}
                        onChange={(e) => {
                          const next =
                            e.target.value === ""
                              ? null
                              : Number(e.target.value);
                          setInOutRowIdx(next);
                          setInOutTouched(true);
                          if (!dataStartTouched && next != null) {
                            setDataStartRowIdx(next + 1);
                          }
                        }}
                      >
                        <option value="">Auto</option>
                        {rows.slice(0, 20).map((_, idx) => (
                          <option key={idx} value={idx}>
                            Row {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ minWidth: 140 }}>
                      <div style={{ ...S.helper, marginBottom: 6 }}>
                        Time row
                      </div>
                      <select
                        style={{ ...S.select, width: "100%" }}
                        value={timeRowIdx ?? ""}
                        onChange={(e) =>
                          setTimeRowIdx(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                      >
                        <option value="">Auto</option>
                        {rows.slice(0, 15).map((_, idx) => (
                          <option key={idx} value={idx}>
                            Row {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ minWidth: 160 }}>
                      <div style={{ ...S.helper, marginBottom: 6 }}>
                        Name column
                      </div>
                      <select
                        style={{ ...S.select, width: "100%" }}
                        value={nameColIdx ?? 1}
                        onChange={(e) => {
                          setNameColIdx(Number(e.target.value));
                          setNameColTouched(true);
                        }}
                      >
                        {rows[0]?.map((_, idx) => (
                          <option key={idx} value={idx}>
                            Column {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ minWidth: 160 }}>
                      <div style={{ ...S.helper, marginBottom: 6 }}>
                        Data starts row
                      </div>
                      <select
                        style={{ ...S.select, width: "100%" }}
                        value={dataStartRowIdx ?? ""}
                        onChange={(e) => {
                          const next =
                            e.target.value === ""
                              ? null
                              : Number(e.target.value);
                          setDataStartRowIdx(next);
                          setDataStartTouched(true);
                        }}
                      >
                        <option value="">Auto</option>
                        {rows.slice(0, 30).map((_, idx) => (
                          <option key={idx} value={idx}>
                            Row {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ ...S.helper }}>
                    Data starts on row{" "}
                    {dataStartRowIdx != null ? dataStartRowIdx + 1 : "—"}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={S.helper}>Position codes</div>
                  {crewExtract?.codesFound?.size ? (
                    Array.from(crewExtract.codesFound)
                      .sort()
                      .map((code) => (
                        <div
                          key={code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div style={{ width: 80 }}>{code}</div>
                          <select
                            style={{ ...S.select, flex: 1 }}
                            value={codeMap[code] ?? ""}
                            onChange={(e) =>
                              handleMapChange(code, e.target.value)
                            }
                          >
                            <option value="">Ignore</option>
                            {(tracks || []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.track_name || t.name || "Unnamed track"}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      No position codes detected yet.
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={S.helper}>Summary</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Dates: {crewExtract?.dateRange?.start || "—"} to{" "}
                    {crewExtract?.dateRange?.end || "—"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Assignments: {crewExtract?.assignments?.length || 0}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Show times: {crewExtract?.showInstances?.size || 0}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Shifts: {crewExtract?.shiftEntries?.size || 0}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Day descriptions:{" "}
                    {Array.from(crewExtract?.shiftEntries?.values?.() || []).filter((s) =>
                      String(s?.day_description || "").trim()
                    ).length}
                  </div>
                  {crewExtract?.unknownCrew?.size ? (
                    <div style={{ fontSize: 12, color: "rgba(255,200,120,0.9)" }}>
                      Unmatched crew: {Array.from(crewExtract.unknownCrew).join(", ")}
                    </div>
                  ) : null}
                  {crewExtract?.unknownCodes?.size ? (
                    <div style={{ fontSize: 12, color: "rgba(255,200,120,0.9)" }}>
                      Unmapped codes: {Array.from(crewExtract.unknownCodes).join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {crewExtract?.unknownCrew?.size ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={S.helper}>Name mapping</div>
                {Array.from(crewExtract.unknownCrew)
                  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
                  .map((name) => {
                    const key = name.toLowerCase();
                    return (
                      <div
                        key={name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ width: 180 }}>{name}</div>
                        <select
                          style={{ ...S.select, flex: 1 }}
                          value={nameMap[key] ?? ""}
                          onChange={(e) =>
                            handleNameMapChange(name, e.target.value)
                          }
                        >
                          <option value="">Ignore</option>
                          {crewList
                            .slice()
                            .sort((a, b) =>
                              (a.crew_name || "").localeCompare(
                                b.crew_name || "",
                                undefined,
                                { sensitivity: "base" }
                              )
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.crew_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
              </div>
            ) : null}

            {importError ? (
              <div style={{ ...S.helper, color: "rgba(255,120,120,0.95)" }}>
                {importError}
              </div>
            ) : null}
            {importResult ? (
              <div style={{ ...S.helper, color: "rgba(140,255,180,0.95)" }}>
                {importResult}
              </div>
            ) : null}
          </div>
        </div>

        <div style={S.modalFooter}>
          <button style={S.button("ghost")} onClick={onClose}>
            Close
          </button>
          <button
            style={S.button(
              "primary",
              importBusy ||
                !crewExtract?.showInstances?.size ||
                (!(crewExtract?.assignments?.length || 0) &&
                  !(crewExtract?.shiftEntries?.size || 0))
            )}
            disabled={
              importBusy ||
              !crewExtract?.showInstances?.size ||
              (!(crewExtract?.assignments?.length || 0) &&
                !(crewExtract?.shiftEntries?.size || 0))
            }
            onClick={runImport}
          >
            {importBusy ? "Importing…" : "Import & Overwrite"}
          </button>
        </div>
      </div>
    </div>
  );
}
