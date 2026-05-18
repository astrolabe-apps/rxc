import { RenderElements, useComputed } from "@react-typed-forms/core";
import { ReactNode } from "react";
import { ErrorMessage } from "./ErrorMessage";
import {
  ControlDefinition,
  getRootDataNode,
  SchemaDataNode,
  visitControlData,
} from "@react-typed-forms/schemas";

interface ErrorEntry {
  title: string | null | undefined;
  error: string;
  scrollElement: HTMLElement | undefined;
}

export function AllErrors({
  definition,
  dataNode,
  labelRenderer,
}: {
  definition: ControlDefinition;
  dataNode: SchemaDataNode;
  labelRenderer: (title: string | null | undefined) => ReactNode;
}) {
  const errors = useComputed<ErrorEntry[] | undefined>(() => {
    const entries: ErrorEntry[] = [];
    visitControlData(definition, getRootDataNode(dataNode), (d, s) => {
      const v = s.control!;
      if (v.error && v.touched) {
        entries.push({
          title: d.title,
          error: v.error,
          scrollElement: v.meta.scrollElement,
        });
      }
      return undefined;
    });
    return entries.length > 0 ? entries : undefined;
  });

  return (
    <RenderElements
      control={errors}
      container={(children) => (
        <div className="py-4">
          <div className="bg-red-200 px-4 py-5 border text-red-700 border-current">
            <div className="mb-2">
              The form could not be submitted for the following reasons:
            </div>
            <>{children}</>
          </div>
        </div>
      )}
    >
      {(entry) => {
        const { title, error, scrollElement } = entry.value;
        return (
          <ErrorMessage
            children={
              <>
                {labelRenderer(title)} - {error}
              </>
            }
            onClick={() =>
              scrollElement?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              })
            }
          />
        );
      }}
    </RenderElements>
  );
}
