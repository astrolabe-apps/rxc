import type { ReactNode } from "react";
import {
  Contents,
  combineClass,
  getProp,
  Section,
  type ClassValue,
  type FormProp,
} from "../framework/index.js";
import { SwitchField } from "../widgets/Switch.js";
import {
  CompoundCycle,
  defaultTranslators,
  type LoaderOptions,
  type Translator,
} from "./translate.js";

/**
 * What a host adds to the loader — this POC standing in for ServiceTas. One
 * of each extension shape the corpus asks for, each a real if small
 * implementation, so the burndown counts them as claimed only because they
 * are:
 *
 * - a **render type** (`Switch`) and two **group kinds** (`MessageBox`, and
 *   `TopLevelGroup` on a compound): ordinary `Translator`s, prepended to the
 *   defaults. They get `props` built like any built-in; a group over a
 *   compound also mounts `CompoundCycle`, the data cycle the loader exports
 *   for exactly this.
 * - an **adornment** kind (`Spotlight`) through `adornments.wrap`, and a
 *   take-over of a built-in one (`HelpText`, to read `helpLabel`, 49 uses)
 *   through `adornments.props`.
 * - a **custom display** by id through `displays`. Only the fixture's;
 *   the corpus's 22 ids are ServiceTas components this POC cannot stand in
 *   for, and the burndown lists them by id.
 */

const switchTranslator: Translator = {
  match: (d, s) =>
    d.type === "Data" &&
    s?.type === "Bool" &&
    d.renderOptions?.type === "Switch",
  renderTypes: ["Switch"],
  render: ({ def, props }) => (
    <SwitchField
      {...props}
      showState={
        (def.renderOptions as { displayLabel?: boolean } | undefined)
          ?.displayLabel !== false
      }
    />
  ),
};

/** The host's own class under the definition's, resolved per read. */
const withOwn =
  (
    own: string,
    given: FormProp<ClassValue> | undefined,
  ): FormProp<ClassValue> =>
  (rc) =>
    combineClass(own, getProp(rc, given)) ?? own;

const levelGlyph: Record<string, string> = {
  info: "ℹ",
  warning: "⚠",
  error: "⛔",
  success: "✓",
};

const messageBoxTranslator: Translator = {
  match: (d) => d.type === "Group" && d.groupOptions?.type === "MessageBox",
  renderTypes: ["MessageBox"],
  render: ({ def, props, children }) => {
    const go = def.groupOptions as
      { level?: string; hideIcon?: boolean } | undefined;
    const level = go?.level ?? "info";
    return (
      <Contents
        hidden={props.hidden}
        disabled={props.disabled}
        title={props.label}
        className={withOwn(`ff-message ff-message-${level}`, props.className)}
        shellClassName={props.shellClassName}
        labelClassName={props.labelClassName}
        labelTextClassName={props.labelTextClassName}
      >
        {go?.hideIcon !== true && (
          <span className="ff-message-icon" aria-hidden>
            {levelGlyph[level] ?? levelGlyph.info}
          </span>
        )}
        <div className="ff-message-body">{children}</div>
      </Contents>
    );
  },
};

const topLevelGroupTranslator: Translator = {
  match: (d, s) =>
    d.type === "Data" &&
    s?.type === "Compound" &&
    !s.collection &&
    (d.renderOptions?.groupOptions as { type?: string } | undefined)?.type ===
      "TopLevelGroup",
  renderTypes: ["Group", "TopLevelGroup"],
  render: ({ props, children }) => (
    <Section
      hidden={props.hidden}
      disabled={props.disabled}
      title={props.label}
      className={withOwn("ff-toplevel", props.className)}
      shellClassName={props.shellClassName}
      labelClassName={props.labelClassName}
      labelTextClassName={props.labelTextClassName}
    >
      <CompoundCycle
        control={props.field}
        value={props.defaultValue}
        hidden={props.hidden}
        dontClearHidden={props.dontClearHidden}
      />
      {children}
    </Section>
  ),
};

function HelpWithLabel({
  label,
  text,
}: {
  label?: string;
  text?: string;
}): ReactNode {
  return (
    <span className="ff-help-labelled">
      {label && <b>{label}</b>}
      {label && text && " "}
      {text}
    </span>
  );
}

export const pocHost: LoaderOptions = {
  translators: [
    switchTranslator,
    messageBoxTranslator,
    topLevelGroupTranslator,
    ...defaultTranslators,
  ],
  adornments: {
    // Shadows the loader's HelpText so `helpLabel` reaches the shell. The
    // prop is a ReactNode already, so no new slot is needed — the host puts
    // its own markup in it. Declines on a Group or Display, as the loader
    // does, and those are then reported dropped.
    HelpText: {
      props: (a, props, def) =>
        def.type === "Data"
          ? {
              ...props,
              helpText: (
                <HelpWithLabel
                  label={
                    typeof a.helpLabel === "string" ? a.helpLabel : undefined
                  }
                  text={typeof a.helpText === "string" ? a.helpText : undefined}
                />
              ),
            }
          : undefined,
    },
    // ServiceTas's onboarding spotlight: a ring and a step number.
    Spotlight: {
      wrap: (a, node) => (
        <div className="ff-spotlight" data-spotlight={String(a.index ?? 0)}>
          {node}
        </div>
      ),
    },
  },
  displays: {
    greeting: ({ props }) => (
      <p className="ff-plain ff-greeting" hidden={props.hidden === true}>
        A host component, found by <code>customId</code>.
      </p>
    ),
  },
};
