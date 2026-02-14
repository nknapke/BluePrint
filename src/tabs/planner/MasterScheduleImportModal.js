import { useEffect, useMemo, useState } from "react";

const MODAL_BODY_STYLE = { maxHeight: "70vh", overflowY: "auto" };

const IGNORE_CODES = new Set([
  "OFF",
  "PTO",
  "WORKCALL",
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

function buildDayBlocks(rows, dateRowIdx, timeRowIdx) {
  if (dateRowIdx == null || timeRowIdx == null) return [];
  const dateRow = rows[dateRowIdx] || [];
  const timeRow = rows[timeRowIdx] || [];
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

    let bestCol = null;
    let bestTime = null;
    for (let c = start; c <= end; c += 1) {
      const tVal = timeRow[c];
      if (!isTimeLike(tVal)) continue;
      const mins = parseTimeToMinutes(tVal);
      if (mins == null) continue;
      if (bestTime == null || mins < bestTime) {
        bestTime = mins;
        bestCol = c;
      }
    }
    if (bestCol == null) {
      for (let c = start; c <= end; c += 1) {
        if ((timeRow[c] || "").trim()) {
          bestCol = c;
          break;
        }
      }
    }

    blocks.push({ dateISO, startCol: start, endCol: end, showCol: bestCol });
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
    () => buildDayBlocks(rows, dateRowIdx, timeRowIdx),
    [rows, dateRowIdx, timeRowIdx]
  );

  const crewBlocks = useMemo(
    () => buildCrewBlocks(rows, dataStartRowIdx, nameColIdx),
    [rows, dataStartRowIdx, nameColIdx]
  );

  const showCols = useMemo(
    () => dayBlocks.map((b) => b.showCol).filter((v) => v !== null),
    [dayBlocks]
  );

  const crewExtract = useMemo(() => {
    if (!rows.length || dataStartRowIdx == null) return null;
    const assignments = [];
    const codesFound = new Set();
    const crewNames = new Set();
    const unknownCodes = new Set();
    const unknownCrew = new Set();
    const dateRange = { start: null, end: null };

    dayBlocks.forEach((b) => {
      if (!dateRange.start || b.dateISO < dateRange.start) dateRange.start = b.dateISO;
      if (!dateRange.end || b.dateISO > dateRange.end) dateRange.end = b.dateISO;
    });

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
        const cols = [];
        if (b.showCol != null) {
          cols.push(b.showCol);
          if (b.showCol + 1 <= b.endCol) cols.push(b.showCol + 1);
        } else {
          cols.push(b.startCol);
          if (b.startCol + 1 <= b.endCol) cols.push(b.startCol + 1);
        }

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
        assignments.push({
          location_id: Number(locId),
          work_date: b.dateISO,
          crew_id: Number(crewId),
          is_working: true,
          track_id: Number(mappedTrack),
        });
      });
    }

    return {
      assignments,
      codesFound,
      crewNames,
      unknownCodes,
      unknownCrew,
      dateRange,
    };
  }, [
    rows,
    dataStartRowIdx,
    nameColIdx,
    dayBlocks,
    crewBlocks,
    crewMap,
    codeMap,
    nameMap,
    locId,
  ]);

  useEffect(() => {
    if (!rows.length) return;
    if (dateRowIdx != null && timeRowIdx != null) return;
    const dRow = detectDateRow(rows);
    const tRow = detectTimeRow(rows, dRow);
    setDateRowIdx(dRow);
    setTimeRowIdx(tRow);
    const startRow = tRow != null ? tRow + 2 : null;
    if (!dataStartTouched) setDataStartRowIdx(startRow);
    const nameCol = detectNameColumn(rows, startRow);
    setNameColIdx(nameCol);
  }, [rows, dateRowIdx, timeRowIdx, dataStartTouched]);

  useEffect(() => {
    if (!rows.length) return;
    if (timeRowIdx == null) return;
    const startRow = timeRowIdx + 2;
    setDataStartRowIdx(startRow);
    if (!dataStartTouched) setDataStartRowIdx(startRow);
    if (!nameColTouched) {
      const nameCol = detectNameColumn(rows, startRow);
      setNameColIdx(nameCol);
    }
  }, [rows, timeRowIdx, nameColTouched, dataStartTouched]);

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
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setFileName(file.name);
      setNameColTouched(false);
      setDataStartTouched(false);
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
    if (!crewExtract || !crewExtract.assignments.length) {
      setImportError("No assignments found to import.");
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

      const assignments = crewExtract.assignments;
      const chunkSize = 500;
      for (let i = 0; i < assignments.length; i += chunkSize) {
        const slice = assignments.slice(i, i + chunkSize);
        await supabasePost(
          "/rest/v1/work_roster_assignments?on_conflict=location_id,work_date,crew_id",
          slice,
          { headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }
        );
      }

      setImportResult(
        `Imported ${assignments.length} assignments for ${crewExtract.dateRange.start} to ${crewExtract.dateRange.end}.`
      );
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
            style={S.button("primary", importBusy || !crewExtract?.assignments?.length)}
            disabled={importBusy || !crewExtract?.assignments?.length}
            onClick={runImport}
          >
            {importBusy ? "Importing…" : "Import & Overwrite"}
          </button>
        </div>
      </div>
    </div>
  );
}
