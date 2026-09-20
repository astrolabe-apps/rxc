import type { ReactNode } from "react";

/** Which of the shell's own elements describes the control. */
export function describedBy(p: {
  id: string;
  error?: ReactNode;
  helpText?: ReactNode;
}): string | undefined {
  return p.error ? `${p.id}-error` : p.helpText ? `${p.id}-help` : undefined;
}
