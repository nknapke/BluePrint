import type { ReactNode } from "react";

type FieldLabelProps = {
  children: ReactNode;
};

export function FieldLabel({ children }: FieldLabelProps) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        opacity: 0.62,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
