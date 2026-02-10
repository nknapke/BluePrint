type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedProps = {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
};

const SEGMENTED_STYLE = {
  display: "inline-flex",
  padding: 4,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
};

const SEGMENTED_BUTTON_STYLE = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid transparent",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  cursor: "pointer",
  transition: "background 160ms ease, transform 120ms ease",
  whiteSpace: "nowrap" as const,
};

export function Segmented({ value, onChange, options }: SegmentedProps) {
  return (
    <div style={SEGMENTED_STYLE}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              ...SEGMENTED_BUTTON_STYLE,
              background: active
                ? "linear-gradient(180deg, rgba(0,122,255,0.20) 0%, rgba(255,255,255,0.06) 100%)"
                : "transparent",
              color: active
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.82)",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
              setTimeout(() => {
                if (e.currentTarget)
                  e.currentTarget.style.transform = "scale(1)";
              }, 120);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
