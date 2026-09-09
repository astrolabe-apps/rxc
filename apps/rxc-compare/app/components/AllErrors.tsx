"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import type { FormStateNode } from "@rxc/forms-core";
import { useFormErrors } from "@rxc/forms-react-core";
import { ErrorMessage } from "./ErrorMessage";

export function AllErrors({ node }: { node: FormStateNode }): Rendered {
  const { rc, rendered } = useReactive();
  const errors = useFormErrors(rc, node);
  if (errors.length === 0) return rendered(null);
  return rendered(
    <div className="py-4">
      <div className="bg-red-200 px-4 py-5 border text-red-700 border-current">
        <div className="mb-2">
          The form could not be submitted for the following reasons:
        </div>
        {errors.map((e) => {
          const title = e.node.getState(rc).definition.title;
          return (
            <ErrorMessage key={e.uniqueId}>
              {title ? `${title} - ${e.error}` : e.error}
            </ErrorMessage>
          );
        })}
      </div>
    </div>
  );
}
