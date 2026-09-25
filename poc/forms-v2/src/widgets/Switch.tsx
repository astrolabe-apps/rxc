import type { Rendered } from "@rx-controls/react";
import {
  fieldRenderer,
  type FieldProps,
  useFieldShell,
  useCheckbox,
  type FieldRenderProps,
} from "../framework/index.js";

export interface SwitchExtra {
  /** Show "On" / "Off" beside the track — legacy's `displayLabel`. */
  showState?: boolean;
}

/**
 * A host's render type. ServiceTas's `Switch` (14 uses, 5 forms) is a
 * boolean drawn as a toggle; here a third-party field the way `Stars` is one,
 * reached from JSON through a host `Translator` rather than a built-in.
 */
function SwitchImpl(
  p: FieldRenderProps<boolean | undefined | null> & SwitchExtra,
): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <Shell
      id={p.id}
      label={p.label}
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <button
        id={p.id}
        type="button"
        role="switch"
        className="ff-switch"
        aria-checked={ctl.checked}
        disabled={locked}
        onClick={() => ctl.setChecked(!ctl.checked)}
        onBlur={ctl.onBlur}
      >
        <span className="ff-switch-track">
          <span className="ff-switch-thumb" />
        </span>
        {p.showState !== false && (
          <span className="ff-switch-state">{ctl.checked ? "On" : "Off"}</span>
        )}
      </button>
    </Shell>,
  );
}

export const SwitchField = fieldRenderer<
  boolean | undefined | null,
  SwitchExtra
>(SwitchImpl) as unknown as <T extends boolean | undefined | null>(
  props: FieldProps<T> & SwitchExtra,
) => Rendered;
