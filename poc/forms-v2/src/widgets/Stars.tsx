import type { Rendered } from "@rx-controls/react";
import {
  fieldRenderer,
  type FieldProps,
  useFieldShell,
  useNumberInput,
  getProp,
  type FieldRenderProps,
  type FormProp,
} from "../framework/index.js";

export interface StarsExtra {
  maxStars?: FormProp<number>;
}

/**
 * A third-party widget. It imports no UI library, draws its own surface, and
 * still gets the active implementation's label / required marker / help /
 * error chrome — which is the whole claim §7 makes for the primitives.
 */
function StarsImpl(
  p: FieldRenderProps<number | undefined | null> & StarsExtra,
): Rendered {
  const Shell = useFieldShell();
  const ctl = useNumberInput(p.field);
  const max = getProp(ctl.rc, p.maxStars) ?? 5;
  const value = ctl.value ?? 0;
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <Shell
      id={p.id}
      label={p.label}
      labelAs="legend"
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <div className="stars" onBlur={ctl.onBlur}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="stars-btn"
            aria-label={`${n} of ${max}`}
            aria-pressed={n <= value}
            disabled={locked}
            onClick={() => ctl.setValue(n === value ? undefined : n)}
          >
            {n <= value ? "★" : "☆"}
          </button>
        ))}
      </div>
    </Shell>,
  );
}

export const Stars = fieldRenderer<number | undefined | null, StarsExtra>(
  StarsImpl,
) as unknown as <T extends number | undefined | null>(
  props: FieldProps<T> & StarsExtra,
) => Rendered;
