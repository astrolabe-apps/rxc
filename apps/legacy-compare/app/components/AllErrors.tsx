import {
  RenderElements,
  useComputed,
  useControlEffect,
} from "@react-typed-forms/core";
import { ReactElement, ReactNode, useEffect } from "react";
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
  // One-time probe: find the acknowledgement control under root and
  // attach a reactive watcher on its `_errors` so we see EVERY change,
  // not just whatever value `useComputed` happens to read.
  useEffect(() => {
    const root = getRootDataNode(dataNode).control as any;
    const ack = root?.fields?.registration?.fields?.acknowledgement;
    if (!ack) {
      console.log("[AllErrors-probe] no acknowledgement control found", {
        root,
      });
      return;
    }
    console.log("[AllErrors-probe] watching ack control", ack);
    // Dump initial state
    console.log("[AllErrors-probe] initial", {
      value: ack.value,
      touched: ack.touched,
      _errors: ack._errors,
      errors: ack.errors,
      error: ack.error,
      valid: ack.valid,
    });
  }, [dataNode]);

  // Reactive watcher on ack errors
  useControlEffect(
    () => {
      const root = getRootDataNode(dataNode).control as any;
      const ack = root?.fields?.registration?.fields?.acknowledgement;
      return ack
        ? {
            value: ack.value,
            errors: ack.errors,
            error: ack.error,
            valid: ack.valid,
            touched: ack.touched,
          }
        : null;
    },
    (state) => console.log("[AllErrors-probe] ack changed", state),
  );

  const errors = useComputed(() => {
    let errors: ReactElement[] = [];
    const rootDataNode = getRootDataNode(dataNode);
    let visited = 0;
    let touched = 0;
    let withError = 0;
    console.log("[AllErrors] computing", {
      definition,
      dataNode,
      rootDataNode,
      rootControl: rootDataNode?.control,
    });
    visitControlData(definition, rootDataNode, (d, s) => {
      visited++;
      const v = s.control!;
      if (v?.touched) touched++;
      if (v?.error) withError++;
      console.log("[AllErrors] visit", {
        title: d.title,
        field: d.field,
        validators: d.validators,
        required: d.required,
        controlValue: v?.value,
        error: v?.error,
        allErrors: v?.errors,
        touched: v?.touched,
        valid: v?.valid,
        meta: v?.meta,
      });
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
    console.log("[AllErrors] result", {
      visited,
      touched,
      withError,
      errorCount: errors.length,
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
