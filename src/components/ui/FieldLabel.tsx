import type { CSSProperties, ReactNode } from "react";

type FieldLabelProps = {
  children: ReactNode;
};

const FIELD_LABEL_STYLE: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  opacity: 0.62,
  marginBottom: 6,
};

export function FieldLabel({ children }: FieldLabelProps) {
  return <div style={FIELD_LABEL_STYLE}>{children}</div>;
}
