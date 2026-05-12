import { RenderElements, useComputed } from "@react-typed-forms/core";
import { ReactElement, ReactNode } from "react";
import { ErrorMessage } from "./ErrorMessage";
import {
  ControlDefinition,
  getRootDataNode,
  SchemaDataNode,
  visitControlData,
} from "@react-typed-forms/schemas";

export function AllErrors({
  definition,
  dataNode,
  labelRenderer,
}: {
  definition: ControlDefinition;
  dataNode: SchemaDataNode;
  labelRenderer: (title: string | null | undefined) => ReactNode;
}) {
  const errors = useComputed(() => {
    let errors: ReactElement[] = [];
    visitControlData(definition, getRootDataNode(dataNode), (d, s) => {
      const v = s.control!;
      if (v.error && v.touched) {
        errors.push(
          <ErrorMessage
            children={
              <>
                {labelRenderer(d.title)} - {v.error}
              </>
            }
            onClick={() =>
              v.meta.scrollElement?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              })
            }
          />,
        );
      }
      return undefined;
    });
    return errors.length > 0 ? errors : undefined;
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
      {(error) => error.value}
    </RenderElements>
  );
}
