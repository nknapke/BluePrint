import { useState } from "react";

export function Table({ S, headerCells, children }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead style={S.thead}>
          <tr>
            {headerCells.map((h) => (
              <th key={h} style={S.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function HoverRow({ S, children }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      style={{
        ...S.trHover,
        background: hover ? "rgba(255,255,255,0.04)" : "transparent",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </tr>
  );
}
