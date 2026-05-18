"use client";

import type { ReadContext } from "@rxc/controls-core";
import { controls } from "@rxc/controls";
import type { FormStateNode } from "@rxc/forms-core";
import { ErrorMessage } from "./ErrorMessage";

interface ErrorEntry {
  uniqueId: number;
  title: string | null | undefined;
  error: string;
}

function collectErrors(rc: ReadContext, node: FormStateNode): ErrorEntry[] {
  const state = node.getState(rc);
  const out: ErrorEntry[] = [];
  if (state.data) {
    const error = rc.getError(state.data);
    const touched = state.touched;
    if (error && touched) {
      out.push({
        uniqueId: node.uniqueId,
        title: state.definition.title,
        error,
      });
    }
  }
  for (const child of node.getChildren(rc)) {
    out.push(...collectErrors(rc, child));
  }
  return out;
}

export const AllErrors = controls<{ node: FormStateNode }>(
  "AllErrors",
  ({ node }, { rc }) => {
    const errors = collectErrors(rc, node);
    if (errors.length === 0) return null;
    return (
      <div className="py-4">
        <div className="bg-red-200 px-4 py-5 border text-red-700 border-current">
          <div className="mb-2">
            The form could not be submitted for the following reasons:
          </div>
          {errors.map((e) => (
            <ErrorMessage key={e.uniqueId}>
              {e.title ? `${e.title} - ${e.error}` : e.error}
            </ErrorMessage>
          ))}
        </div>
      </div>
    );
  },
);
