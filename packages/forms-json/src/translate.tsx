import { useEffect, useMemo, type ReactNode } from "react";
import {
  effect,
  untrackedRead,
  type Control,
  type ControlContext,
  type ReadContext,
} from "@rx-controls/core";
import {
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  Action,
  arrayActions,
  StandardActionIds,
  useFormScope,
  CheckboxField,
  CheckListField,
  Contents,
  Dialog,
  DisplayOnlyField,
  Elements,
  getProp,
  HtmlDisplay,
  IconDisplay,
  InlineGroup,
  RadioField,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  type ClassValue,
  type FlexLayout,
  type FieldOption,
  type CheckListValue,
  type FieldProps,
  type FormProp,
  type Validator,
} from "@rx-controls/forms-react";
import { useDefaultValue } from "@rx-controls/forms-react/internal";
import type {
  ControlDefinition,
  IconReference,
  SchemaField,
} from "@rx-controls/forms-schema";
import {
  dateValidator,
  jsonataValidator,
  toFormProp,
  toValueProp,
} from "./expressions.js";
import {
  asDef,
  asField,
  schemaOptions,
  str,
  toClassValue,
  type AnyDef,
  type AnyExpr,
  type AnyField,
} from "./defs.js";
import {
  elementScope,
  resolveRef,
  rootScope,
  withVariables,
  type DataScope,
  type ResolvedRef,
} from "./scope.js";
import type { LoaderOptions, LoaderWarning } from "./loader.js";
import type {
  CompoundCycleProps,
  IconTranslator,
  RetranslateRebuild,
  TranslateArgs,
  Translator,
} from "./translator.js";
import { displayToggle, Offscreen } from "./layoutStyle.js";

/**
 * Scoped to one definition — the walk supplies the `path`. A subject may be
 * the format's `null`; the warning carries `undefined`.
 */
type Warn = (
  w: Omit<LoaderWarning, "path" | "subject"> & { subject?: string | null },
) => void;
type Collect = (w: LoaderWarning) => void;

/**
 * Collected once, during the memoised walk. A collection re-translates its
 * children per element at render time, over definitions the walk has already
 * seen, so that pass collects nothing rather than reporting each gap once per
 * row. See `translateForm`.
 */
const noCollect: Collect = () => {};

/**
 * What the built-in translators are given: the public {@link TranslateArgs},
 * with the definition and schema read through the loader's open views.
 */
type Args = Omit<TranslateArgs, "def" | "schema"> & {
  def: AnyDef;
  schema?: AnyField;
};
interface Builtin {
  match(def: AnyDef, schema?: AnyField): boolean;
  render(args: Args): ReactNode;
  renderTypes?: string[];
  dynamics?: string[];
  ownsChildren?: boolean;
}

export function legacyIconClass(icon: IconReference): string {
  switch (icon.library) {
    case "FontAwesome":
      return `fa fa-${icon.name}`;
    case "Material":
    case "CssClass":
      return icon.name;
    default:
      return `${icon.library ?? "fa"} fa-${icon.name}`;
  }
}

const defaultIcon: IconTranslator = (icon, className) => (
  <i
    className={[legacyIconClass(icon), className].filter(Boolean).join(" ")}
    aria-hidden
  />
);

const defaultUnsupported = (def: ControlDefinition) => {
  const ro = asDef(def).renderOptions?.type;
  return <TextDisplay text={`Unsupported: ${def.type}${ro ? ` / ${ro}` : ""}`} />;
};

/** A collection row: the element, then its remove button. */
const rowLayout: FlexLayout = { direction: "row", gap: 8, align: "end" };

/**
 * Legacy's Flex options onto a group layout. `direction` unset is CSS's
 * default, a row — legacy set `flexDirection` only when given. `gap` unset
 * is the theme's.
 */
function flexLayout(go: Record<string, unknown>): FlexLayout {
  return {
    direction: (go.direction as "row" | "column" | undefined) ?? undefined,
    gap: (go.gap as string | undefined) || undefined,
  };
}

const hasDynamic = (d: AnyDef, t: string) =>
  !!d.dynamic?.some((x) => x.type === t);

/**
 * Legacy's `fieldOptions` rule, verbatim (`formStateNode.ts`): the expression
 * yields an array (a scalar is wrapped); an object entry *is* an option, a
 * primitive names one of the schema's by loose equality or becomes
 * `{ name: String(x), value: x }`; nulls drop out; and an empty list means
 * every schema option. The corpus uses both halves — a filter over the
 * schema's options (Fire) and a list of whole `{ name, value }` objects with
 * nothing in the schema at all (MastEoi's Yes/No radios).
 */
export function allowedOptions(
  all: FieldOption[],
  allowed: unknown,
): FieldOption[] {
  const list: unknown[] =
    allowed == null ? [] : Array.isArray(allowed) ? allowed : [allowed];
  if (list.length === 0) return all;
  return list
    .map((x) =>
      typeof x === "object"
        ? (x as FieldOption | null)
        : (all.find((o) => o.value == x) ?? {
            name: String(x),
            value: x as FieldOption["value"],
          }),
    )
    .filter((x): x is FieldOption => x != null);
}

/**
 * The options an options widget gets: the schema's, narrowed or replaced by
 * an `AllowedOptions` expression when the definition carries one. A
 * `FormProp`, so a data-driven list re-filters as the data moves.
 */
function optionsFor(
  schema: AnyField | undefined,
  dynamicValue: TranslateArgs["dynamicValue"],
): FormProp<FieldOption[]> | undefined {
  const all = schemaOptions(schema);
  const allowed = dynamicValue("AllowedOptions");
  if (!allowed) return all.length ? all : undefined;
  return (rc) => allowedOptions(all, getProp(rc, allowed));
}

const hasOptions = (d: AnyDef, s?: AnyField) =>
  !!s?.options?.length || hasDynamic(d, "AllowedOptions");

/** The built-in translators, in match order. */
const builtins: Builtin[] = [
  {
    match: (d) => d.type === "Action",
    render: ({ def, props, children, onClick, icon }) => (
      <Action
        actionId={def.actionId ?? "action"}
        text={def.actionText ?? def.title}
        onClick={onClick}
        hidden={props.hidden}
        disabled={props.disabled}
        className={props.className}
        shellClassName={props.shellClassName}
        textClassName={props.textClassName}
        variant={actionVariantOf(def.actionStyle)}
        icon={def.icon?.name ? icon(def.icon) : undefined}
        iconPlacement={
          def.iconPlacement === "AfterText"
            ? "after"
            : def.iconPlacement === "ReplaceText"
              ? "replace"
              : "before"
        }
        disableType={
          def.disableType === "Global"
            ? "global"
            : def.disableType === "None"
              ? "none"
              : "self"
        }
      >
        {def.actionStyle === "Group" && children.length ? children : undefined}
      </Action>
    ),
  },
  {
    // Legacy's Dialog group: children with `placement: "trigger"` render in
    // place, the rest inside a dialog the trigger opens by *action id* —
    // `openDialog` / `closeDialog` — which the translator claims for its own
    // subtree before the host's handler sees them, exactly as legacy's
    // DefaultDialogRenderer did with a child `actionHandler`.
    match: (d) => d.type === "Group" && d.groupOptions?.type === "Dialog",
    renderTypes: ["Dialog"],
    ownsChildren: true,
    render: ({ def, props, retranslate }) => (
      <DialogGroup
        className={props.className}
        // Read here, at translate time, so the unread audit sees it.
        title={
          typeof def.groupOptions?.title === "string"
            ? def.groupOptions.title
            : undefined
        }
        placements={(def.children ?? []).map((c) => c.placement)}
        hidden={props.hidden}
        retranslate={retranslate!}
      />
    ),
  },
  {
    match: (d) => d.type === "Display" && d.displayData?.type === "Text",
    dynamics: ["Display"],
    render: ({ def, props, dynamicValue }) => {
      // Read the static text first: it is the fallback, so it is consumed
      // whether or not a dynamic override exists, and the audit should say so.
      const text = str(def.displayData?.text);
      return (
        <TextDisplay
          text={
            (dynamicValue("Display") as FormProp<ReactNode> | undefined) ?? text
          }
          hidden={props.hidden}
          className={props.className}
          shellClassName={props.shellClassName}
          textClassName={props.textClassName}
        />
      );
    },
  },
  {
    match: (d) => d.type === "Display" && d.displayData?.type === "Html",
    dynamics: ["Display"],
    render: ({ def, props, dynamicValue }) => {
      const html = str(def.displayData?.html);
      return (
        <HtmlDisplay
          html={
            (dynamicValue("Display") as FormProp<string> | undefined) ?? html
          }
          hidden={props.hidden}
          className={props.className}
          shellClassName={props.shellClassName}
          textClassName={props.textClassName}
        />
      );
    },
  },
  {
    // The one display whose accessible name is load-bearing — and where the
    // legacy `Tooltip` adornment lands.
    match: (d) => d.type === "Display" && d.displayData?.type === "Icon",
    render: ({ def, props, icon }) => {
      const ref = def.displayData?.icon as IconReference | undefined;
      const iconClass = str(def.displayData?.iconClass);
      return (
        <IconDisplay
          icon={ref?.name ? icon(ref, iconClass) : undefined}
          accessibleName={tooltipOf(def)}
          hidden={props.hidden}
          className={props.className}
          shellClassName={props.shellClassName}
          textClassName={props.textClassName}
        />
      );
    },
  },
  {
    // Legacy's DisplayOnly: the value as text — options by name, dates and
    // booleans by type (the loader knows the schema; the widget gets a
    // `format`). `required` is dropped, as legacy ignores it here.
    // `sampleText` is what a designer sees in place of an empty value.
    match: (d) => d.type === "Data" && d.renderOptions?.type === "DisplayOnly",
    renderTypes: ["DisplayOnly"],
    dynamics: ["AllowedOptions"],
    render: ({ props, schema, def, dynamicValue }) => {
      const ro: Record<string, unknown> = def.renderOptions ?? {};
      return (
        <DisplayOnlyField
          {...props}
          required={undefined}
          options={optionsFor(schema, dynamicValue)}
          emptyText={str(ro.emptyText)}
          sampleText={str(ro.sampleText)}
          noSelection={def.noSelection === true || ro.noSelection === true}
          format={formatFor(schema)}
        />
      );
    },
  },
  {
    // A compound field's control is a region over its children — the data
    // context the children's `../x` refs climb out of. Rendered as a group,
    // and legacy lets `renderOptions.groupOptions` say which kind: 46 in
    // the corpus, 33 of them Standard.
    match: (d, s) =>
      d.type === "Data" && s?.type === "Compound" && !s.collection,
    renderTypes: ["Standard", "Group", "Contents", "Inline", "Flex"],
    render: ({ props, children, def }) => {
      const nested = (def.renderOptions?.groupOptions ?? {}) as Record<
        string,
        unknown
      >;
      const kind = nested.type as string | undefined;
      const groupProps = {
        hidden: props.hidden,
        disabled: props.disabled,
        title: props.label,
        className: props.className,
        shellClassName: props.shellClassName,
        labelClassName: props.labelClassName,
        labelTextClassName: props.labelTextClassName,
      };
      // A compound is data too: legacy defaulted it (`{}` on a hidden-then-
      // shown section, so its children have an object to bind into). A
      // group boundary has no binding, so the loader runs the same effect.
      const withDefault = (
        <>
          <CompoundCycle
            control={props.field}
            value={props.defaultValue}
            hidden={props.hidden}
            dontClearHidden={props.dontClearHidden}
          />
          {children}
        </>
      );
      if (kind === "Inline")
        return <InlineGroup {...groupProps}>{withDefault}</InlineGroup>;
      return (
        <Contents
          {...groupProps}
          layout={kind === "Flex" ? flexLayout(nested) : undefined}
        >
          {withDefault}
        </Contents>
      );
    },
  },
  {
    // Legacy's CheckList: a collection of option values, one checkbox per
    // option (schemas-html's createCheckListRenderer). Before the collection
    // translator, which would otherwise claim the array.
    match: (d) => d.type === "Data" && d.renderOptions?.type === "CheckList",
    renderTypes: ["CheckList"],
    dynamics: ["AllowedOptions"],
    render: ({ props, schema, dynamicValue }) => (
      <CheckListField
        {...(props as FieldProps<CheckListValue[] | undefined>)}
        options={optionsFor(schema, dynamicValue)}
      />
    ),
  },
  {
    // Legacy's Array renderer: the rows, a Remove on each, an Add below —
    // unless `noRemove` / `noAdd`, which 21 of the corpus's 25 arrays set
    // (read-only lists). `noReorder` is read and does nothing, exactly as
    // legacy's Array renderer did: it had no reorder UI, the flag rode along.
    match: (d, s) => d.type === "Data" && !!s?.collection,
    renderTypes: ["Standard", "Array"],
    render: ({ props, element, def, schema }) => {
      const len = def.validators?.find((v) => v.type === "Length");
      const ro = (def.renderOptions ?? {}) as Record<string, unknown>;
      void ro.noReorder;
      const noAdd = ro.noAdd === true;
      const noRemove = ro.noRemove === true;
      const removeText = (ro.removeText as string | undefined) ?? "Remove";
      const addText = (ro.addText as string | undefined) ?? "Add";
      const removeActionId =
        (ro.removeActionId as string | undefined) ?? StandardActionIds.remove;
      const addActionId =
        (ro.addActionId as string | undefined) ?? StandardActionIds.add;
      const bounds = {
        minLength: len?.min as number | undefined,
        maxLength: len?.max as number | undefined,
      };
      const collectionProps = props as FieldProps<unknown[]>;
      const newElement = schema?.type === "Compound" ? {} : undefined;
      return (
        <>
          <Elements
            {...collectionProps}
            {...bounds}
            empty={<TextDisplay text="Nothing yet." />}
          >
            {(item, index, actions) => (
              <Contents layout={rowLayout}>
                {element!(item, index)}
                {!noRemove && (
                  <Action
                    actionId={removeActionId}
                    text={removeText}
                    variant="secondary"
                    disabled={!actions.canRemove}
                    onClick={() => actions.remove(index)}
                  />
                )}
              </Contents>
            )}
          </Elements>
          {!noAdd && (
            <ArrayAdd
              control={collectionProps.field}
              bounds={bounds}
              actionId={addActionId}
              text={addText}
              value={newElement}
              hidden={props.hidden}
            />
          )}
        </>
      );
    },
  },
  {
    // Radio, with legacy's per-option children: the definition's children
    // are translated once per **resolved** option — the list after
    // `AllowedOptions`, as legacy expanded them — against the *parent*
    // scope, with `$formData.option` / `$formData.optionSelected` bound.
    // Resolved options are only known at render, so translation is lazy
    // and memoised per option value (the expression cache is keyed the same
    // way, so a repeat costs nothing), the collection pattern: rows are
    // translated per element at render too. For the audit, one eager pass
    // over the schema's options — or a representative option when the
    // schema has none — collects the children's warnings once.
    match: (d, s) =>
      d.type === "Data" &&
      d.renderOptions?.type === "Radio" &&
      hasOptions(d, s),
    renderTypes: ["Radio"],
    dynamics: ["AllowedOptions"],
    ownsChildren: true,
    render: ({ def, props, schema, retranslate, dynamicValue }) => {
      const ro = (def.renderOptions ?? {}) as Record<string, unknown>;
      const hasChildren = !!def.children?.length;
      const field = props.field as Control<unknown>;
      const forOption = (o: FieldOption, quiet: boolean): ReactNode[] =>
        retranslate!(
          {},
          {
            at: "own",
            variables: {
              key: `option:${String(o.value)}`,
              values: (rc) => ({
                formData: {
                  option: o,
                  optionSelected:
                    String(rc.getValue(field)) === String(o.value),
                },
              }),
            },
            collectWarnings: !quiet,
          },
        );
      const perOption = new Map<string, ReactNode[]>();
      if (hasChildren) {
        const eager = schemaOptions(schema);
        eager.forEach((o, i) =>
          perOption.set(String(o.value), forOption(o, i > 0)),
        );
        // No static options to walk: audit the children against a stand-in.
        if (eager.length === 0) forOption({ name: "", value: "" }, false);
      }
      const childrenFor = (o: FieldOption): ReactNode => {
        const k = String(o.value);
        let nodes = perOption.get(k);
        if (!nodes) {
          nodes = forOption(o, true);
          perOption.set(k, nodes);
        }
        return <>{nodes}</>;
      };
      return (
        <RadioField
          {...props}
          options={optionsFor(schema, dynamicValue)}
          entryClassName={toClassValue(ro.entryWrapperClass as string)}
          selectedClassName={toClassValue(ro.selectedClass as string)}
          notSelectedClassName={toClassValue(ro.notSelectedClass as string)}
        >
          {hasChildren ? childrenFor : undefined}
        </RadioField>
      );
    },
  },
  {
    // Options come off the schema here and become a prop there; nothing below
    // this line knows a schema exists.
    match: (d, s) =>
      d.type === "Data" &&
      (hasOptions(d, s) || d.renderOptions?.type === "Dropdown"),
    renderTypes: ["Standard", "Dropdown"],
    dynamics: ["AllowedOptions"],
    render: ({ props, schema, dynamicValue }) => (
      <SelectField {...props} options={optionsFor(schema, dynamicValue)} />
    ),
  },
  {
    match: (d, s) => d.type === "Data" && s?.type === "Bool",
    renderTypes: ["Standard", "Checkbox"],
    render: ({ props }) => <CheckboxField {...props} />,
  },
  {
    match: (d) => d.type === "Data",
    renderTypes: ["Standard", "Textfield", "Multiline"],
    render: ({ props, def }) => (
      <TextField
        {...props}
        multiline={def.renderOptions?.type === "Multiline"}
        placeholder={def.renderOptions?.placeholder as string | undefined}
      />
    ),
  },
  {
    match: (d) => d.type === "Group" && d.groupOptions?.type === "Tabs",
    renderTypes: ["Tabs"],
    render: ({ def, props, children, childProps }) => (
      <Tabs
        items={(def.children ?? []).map((c, i) => ({
          // By position: two tabs may share a title, and a key must not.
          key: String(i),
          title: c.title ?? `Tab ${i + 1}`,
          // Legacy's TabsRenderer drops a hidden child from the strip.
          hidden: childProps[i]?.hidden,
          children: children[i],
        }))}
        hidden={props.hidden}
        className={props.className}
      />
    ),
  },
  {
    // Legacy's Inline: prose. Not a row — a span whose children render
    // inline through the scope (a text display becomes a span, a bound
    // value loses its shell). 222 in the corpus, 214 with the title hidden.
    match: (d) => d.type === "Group" && d.groupOptions?.type === "Inline",
    renderTypes: ["Inline"],
    render: ({ props, children }) => (
      <InlineGroup
        hidden={props.hidden}
        disabled={props.disabled}
        title={props.label}
        className={props.className}
        shellClassName={props.shellClassName}
        labelClassName={props.labelClassName}
        labelTextClassName={props.labelTextClassName}
      >
        {children}
      </InlineGroup>
    ),
  },
  {
    // Legacy's Flex group: a flex box, `direction` and `gap`. 36 in the
    // corpus, 35 of them on the defaults. The group's *body* is the flex box,
    // as legacy's was, so `styleClass` (`justify-between`, `items-end`: 21 of
    // them) lands on it, and the theme gives it its own class.
    match: (d) => d.type === "Group" && d.groupOptions?.type === "Flex",
    renderTypes: ["Flex"],
    render: ({ def, props, children }) => (
      <Contents
        hidden={props.hidden}
        disabled={props.disabled}
        title={props.label}
        className={props.className}
        shellClassName={props.shellClassName}
        labelClassName={props.labelClassName}
        labelTextClassName={props.labelTextClassName}
        layout={flexLayout(def.groupOptions ?? {})}
      >
        {children}
      </Contents>
    ),
  },
  {
    match: (d) => d.type === "Group",
    renderTypes: ["Standard", "Contents"],
    render: ({ props, children }) => (
      <Contents
        hidden={props.hidden}
        disabled={props.disabled}
        title={props.label}
        className={props.className}
        shellClassName={props.shellClassName}
        labelClassName={props.labelClassName}
        labelTextClassName={props.labelTextClassName}
      >
        {children}
      </Contents>
    ),
  },
];

/** {@link builtins}, as the public shape: a definition is a definition. */
export const defaultTranslators = builtins as unknown as readonly Translator[];

/**
 * Build the props a JSX author would have written.
 *
 * **The loader creates the binding**, never a translator — a translator that
 * bound its own field could register the semantics below the boundary, where a
 * renderer could drop them.
 */
function buildProps(
  ctx: ControlContext,
  scope: DataScope,
  def: AnyDef,
  ref: ResolvedRef | undefined,
  warn: Warn,
  seen: Set<string>,
  hostAdornments: Set<string>,
  icon: IconTranslator,
): FieldProps<any> {
  const schema = ref?.schema;
  // A reference that walks off the data binds a detached control, so the
  // widget renders and edits nothing rather than editing the scope's object.
  const control = def.field
    ? (ref?.control ?? ctx.newControl<unknown>(undefined))
    : scope.control;
  const dyn = (t: string) => def.dynamic?.find((d) => d.type === t)?.expr;

  const visible = dyn("Visible");
  const disabled = dyn("Disabled");
  const label = dyn("Label");
  const dynDefault = dyn("DefaultValue");

  const expr: (detail: string) => void = (detail) =>
    warn({ kind: "expression", subject: def.field ?? def.title, detail });

  const validate: Record<string, Validator<any>> = {};
  let jsonataN = 0;
  let dateN = 0;
  for (const v of def.validators ?? []) {
    if (v.type === "Date") {
      // Legacy's Date validator, keyed `date`, numbered past the first.
      validate[dateN ? `date${dateN}` : "date"] = dateValidator(
        v as Parameters<typeof dateValidator>[0],
      );
      dateN++;
      continue;
    }
    if (v.type === "Jsonata") {
      // An async validator: the expression yields the message, against
      // the parent data. Keyed like legacy's `jsonata`, numbered past the first.
      const fn = jsonataValidator(scope, v.expression as string, expr);
      if (fn) validate[jsonataN ? `jsonata${jsonataN}` : "jsonata"] = fn;
      jsonataN++;
      continue;
    }
    const kind = (v as { type: string }).type;
    if (kind !== "Length") {
      markSeen(seen, `validators.${v.type}`, v);
      warn({
        kind: "validator",
        subject: def.field ?? def.title,
        detail: `no translator for validator "${kind}" — the rule is not enforced`,
      });
    } else if (schema?.collection) {
      // Consumed by the collection translator as min/max length.
    } else if (schema?.type !== "String") {
      warn({
        kind: "validator",
        subject: def.field ?? def.title,
        detail: `Length on a ${schema?.type ?? "?"} field — this loader measures string length only`,
      });
    }
    if (kind === "Length" && !schema?.collection) {
      // Read now — the audit runs at translate time.
      const { min, max } = v as { min?: number; max?: number };
      validate.length = (value) => {
        const n = typeof value === "string" ? value.length : 0;
        if (min !== undefined && n < min) return `At least ${min}`;
        if (max !== undefined && n > max) return `At most ${max}`;
        return null;
      };
    }
  }

  // Hoisted out of the read closures below. Building the prop is what compiles
  // a jsonata expression, so doing it here is what puts a compile failure in
  // the returned warnings rather than in the first render — and a sync
  // expression gets one stable closure instead of a fresh one per read.
  const visibleProp = visible
    ? toFormProp(ctx, scope, visible, expr)
    : undefined;
  const labelProp = label ? toValueProp(ctx, scope, label, expr) : undefined;
  const disabledProp = disabled
    ? toFormProp(ctx, scope, disabled, expr)
    : undefined;

  // `undefined` while the expression is pending — legacy's `visible: null` —
  // which the boundaries treat as shown but not yet decided: no clear, no
  // default, no validation until the answer lands.
  const hiddenFromExpr: FormProp<boolean | undefined> | undefined = visibleProp
    ? (rc) => {
        const v = getProp(rc, visibleProp);
        return v === undefined ? undefined : !v;
      }
    : undefined;
  // The static flags are the fallbacks when an expression exists — read
  // them first, so the audit counts them as consumed (a `hidden: true` with
  // a Visible expression is "hidden unless…", and legacy reads it the same).
  const staticHidden = def.hidden;
  const staticDisabled = def.disabled;
  // Legacy: `defaultValue != null` is a default; the editor writes `null`
  // on every control, and that is "none". The dynamic form is scriptable.
  const staticDefault = def.defaultValue;
  const defaultValue: FormProp<unknown> | undefined = dynDefault
    ? toValueProp(ctx, scope, dynDefault, expr)
    : staticDefault === null
      ? undefined
      : staticDefault;

  // `hideTitle` is legacy's "render no label"; a group keeps the same flag
  // under `groupOptions`. Read both so the audit sees them either way.
  const hideTitle =
    def.hideTitle === true ||
    (def.type === "Group" && def.groupOptions?.hideTitle === true) ||
    (def.renderOptions?.groupOptions as { hideTitle?: boolean } | undefined)
      ?.hideTitle === true;

  // The HelpText adornment is the contract's `helpText` prop. Its
  // `placement` is dropped on purpose: where help text sits is the shell's
  // business, and the eight libraries surveyed each fix it somewhere
  //. On a Group or a Display there is no prop for it to become.
  // Unless the host registered its own `HelpText`, which then owns it.
  const help = hostAdornments.has("HelpText")
    ? undefined
    : def.adornments?.find((a) => a.type === "HelpText");
  const helpText =
    def.type === "Data" && typeof help?.helpText === "string"
      ? help.helpText
      : undefined;

  // An Icon adornment at the control's start or end is the field's
  // `startIcon` / `endIcon`; anywhere else it has no slot and is
  // reported. Data only — a display has no icon slots of its own.
  let startIcon: ReactNode | undefined;
  let endIcon: ReactNode | undefined;
  if (def.type === "Data" && !hostAdornments.has("Icon"))
    for (const a of def.adornments ?? []) {
      if (a.type !== "Icon") continue;
      const ref = a.icon as IconReference | undefined;
      if (!ref?.name) continue;
      const node = icon(ref, str(a.iconClass));
      if (a.placement === "ControlEnd") endIcon = node;
      else if (a.placement === "ControlStart") startIcon = node;
    }

  // Legacy renders a label for Data and Group controls only: a Display's
  // `title` is the designer's name for it, an Action's is the button text
  // fallback (read by the action translator). Building a label for them
  // would be reported as dropped by every translator — and rightly.
  const labelled = def.type === "Data" || def.type === "Group";
  return {
    field: control,
    label:
      !labelled || hideTitle
        ? undefined
        : labelProp
          ? (rc) => getProp(rc, labelProp) as ReactNode
          : (def.title ?? schema?.displayName ?? undefined),
    required: def.required ?? undefined,
    requiredMessage: def.requiredErrorText ?? undefined,
    helpText,
    startIcon,
    endIcon,
    hidden: hiddenFromExpr ?? staticHidden ?? undefined,
    // A pending async `disabled` is not disabled; there is no third state here.
    disabled: disabledProp
      ? (rc) => getProp(rc, disabledProp) ?? false
      : (staticDisabled ?? undefined),
    readOnly: def.readonly ?? undefined,
    dontClearHidden: def.dontClearHidden ?? undefined,
    defaultValue,
    validate: Object.keys(validate).length ? validate : undefined,
    className: toClassValue(def.styleClass),
    textClassName: toClassValue(def.textClass),
    shellClassName: toClassValue(def.layoutClass),
    labelClassName: labelled ? toClassValue(def.labelClass) : undefined,
    labelTextClassName: labelled ? toClassValue(def.labelTextClass) : undefined,
  };
}

/**
 * The blind spot the warning list had: a property no translator reads is
 * silently dropped, and the loader has no list of what it dropped because it
 * never looked. So the definition handed to `buildProps`, `warnUnhandled` and
 * the matched translator is a **recording proxy** — every property read is
 * noted, one level down into `renderOptions` / `groupOptions` / `displayData`
 * — and whatever was never read is reported afterwards. Properties whose value
 * carries nothing (`null`, `false`, `""`, `{}`, `[]`) are skipped: the editor
 * writes `defaultValue: null` and `fieldDef: {}` on every control.
 */
const nestedKeys = ["renderOptions", "groupOptions", "displayData"] as const;
/**
 * The definition's arrays of *entries* — each an object with a `type`. Their
 * properties were invisible to the audit: the proxy stopped at the array, so
 * a dropped `adornments[0].placement` never showed. An
 * entry is recorded as `adornments.HelpText.placement` — by its `type`, since
 * that is how a reader finds it — and everything under it is recorded too
 * (`dynamic.Visible.expr.field`). `children` are definitions of their own
 * and are translated, and audited, separately.
 */
const entryArrayKeys = ["adornments", "validators", "dynamic"] as const;

/**
 * An entry nothing handles is reported once, as itself; its properties are
 * then not audited one by one — that would count the same gap five times.
 */
function markSeen(seen: Set<string>, prefix: string, obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as object)) {
    seen.add(`${prefix}.${k}`);
    if (v && typeof v === "object" && !Array.isArray(v))
      markSeen(seen, `${prefix}.${k}`, v);
  }
}

const entrySegment = (el: unknown, index: string): string =>
  el &&
  typeof el === "object" &&
  typeof (el as { type?: unknown }).type === "string"
    ? (el as { type: string }).type
    : index;

function meaningful(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

function recording<T extends object>(
  target: T,
  seen: Set<string>,
  prefix = "",
  deep = false,
): T {
  return new Proxy(target, {
    get(t, prop, r) {
      if (typeof prop === "string") {
        seen.add(prefix + prop);
        const v = Reflect.get(t, prop, r);
        if (!v || typeof v !== "object") return v;
        if (!prefix && (nestedKeys as readonly string[]).includes(prop))
          return recording(v as object, seen, prop + ".");
        if (!prefix && (entryArrayKeys as readonly string[]).includes(prop))
          return recordingEntries(v as unknown[], seen, prop);
        // Inside an entry, everything is recorded: `dynamic.Visible.expr.field`.
        if (deep && !Array.isArray(v))
          return recording(v as object, seen, prefix + prop + ".", true);
        return v;
      }
      return Reflect.get(t, prop, r);
    },
  });
}

/** An array of `{ type, … }` entries, each recorded under `key.<type>.`. */
function recordingEntries<T extends unknown[]>(
  arr: T,
  seen: Set<string>,
  key: string,
): T {
  return new Proxy(arr, {
    get(t, prop, r) {
      const v = Reflect.get(t, prop, r);
      if (
        typeof prop === "string" &&
        /^\d+$/.test(prop) &&
        v &&
        typeof v === "object"
      )
        return recording(
          v as object,
          seen,
          `${key}.${entrySegment(v, prop)}.`,
          true,
        );
      return v;
    },
  });
}

function warnUnread(def: AnyDef, seen: Set<string>, warn: Warn) {
  const subject = def.title ?? def.field;
  const report = (path: string) =>
    warn({
      kind: "unread",
      subject,
      detail: `"${path}" is not read by any translator — dropped`,
    });
  for (const [k, v] of Object.entries(def)) {
    if (!meaningful(v) || parentReadKeys.has(k)) continue;
    if (!seen.has(k)) {
      report(k);
    } else if (
      (nestedKeys as readonly string[]).includes(k) &&
      typeof v === "object"
    ) {
      for (const [nk, nv] of Object.entries(v as object))
        if (meaningful(nv) && !seen.has(`${k}.${nk}`)) report(`${k}.${nk}`);
    } else if (
      (entryArrayKeys as readonly string[]).includes(k) &&
      Array.isArray(v)
    ) {
      v.forEach((el, i) => {
        if (!el || typeof el !== "object") return;
        unreadDeep(
          el as object,
          `${k}.${entrySegment(el, String(i))}`,
          seen,
          report,
        );
      });
    }
  }
}

/** Every meaningful leaf under an entry that nothing read, as a dotted path. */
function unreadDeep(
  obj: object,
  prefix: string,
  seen: Set<string>,
  report: (path: string) => void,
): void {
  for (const [nk, nv] of Object.entries(obj)) {
    if (!meaningful(nv)) continue;
    const path = `${prefix}.${nk}`;
    if (!seen.has(path)) report(path);
    else if (nv && typeof nv === "object" && !Array.isArray(nv))
      unreadDeep(nv as object, path, seen, report);
  }
}

/**
 * The other blind spot: a definition property that
 * `buildProps` *reads* — and so counts as seen — into a prop the translator
 * then never passes on. A group's `layoutClass` became `shellClassName`, and
 * every group translator dropped it, silently. So the props handed to a
 * translator are recorded too, and a prop that was built from something and
 * never read is reported against the property it was built from. `field` is
 * exempt: the loader consumes it by resolving the scope.
 */
const propSources: Record<string, (keyof AnyDef)[]> = {
  label: ["title"],
  required: ["required"],
  requiredMessage: ["requiredErrorText"],
  hidden: ["hidden"],
  disabled: ["disabled"],
  readOnly: ["readonly"],
  dontClearHidden: ["dontClearHidden"],
  defaultValue: ["defaultValue"],
  validate: ["validators"],
  startIcon: ["adornments"],
  endIcon: ["adornments"],
  className: ["styleClass"],
  textClassName: ["textClass"],
  shellClassName: ["layoutClass"],
  labelClassName: ["labelClass"],
  labelTextClassName: ["labelTextClass"],
};

function recordingProps<T extends object>(props: T, read: Set<string>): T {
  return new Proxy(props, {
    get(t, prop, r) {
      if (typeof prop === "string") read.add(prop);
      return Reflect.get(t, prop, r);
    },
    // A spread reads every key.
    ownKeys(t) {
      for (const k of Reflect.ownKeys(t))
        if (typeof k === "string") read.add(k);
      return Reflect.ownKeys(t);
    },
  });
}

function warnDropped(
  props: FieldProps<any>,
  read: Set<string>,
  def: AnyDef,
  warn: Warn,
): void {
  const subject = def.title ?? def.field;
  for (const [propKey, sources] of Object.entries(propSources)) {
    if (read.has(propKey)) continue;
    if ((props as unknown as Record<string, unknown>)[propKey] === undefined)
      continue;
    for (const k of sources)
      if (meaningful(def[k]))
        warn({
          kind: "unread",
          subject,
          detail: `"${k}" was built into the "${propKey}" prop, which the translator never read — dropped`,
        });
  }
}

/**
 * How one value of a schema type reads as text — legacy `textValue` minus the
 * option lookup, which the widget does itself. Built here because the schema
 * is loader-only; a JSX author passes their own `format` or none.
 */
function formatFor(
  schema: SchemaField | undefined,
): ((v: unknown) => string) | undefined {
  if (!schema) return undefined;
  switch (schema.type) {
    case "Date":
      return (v) => new Date(v as string).toLocaleDateString();
    case "DateTime":
      // A naive date-time is UTC, as legacy reads it.
      return (v) => {
        const s = String(v);
        return new Date(
          /[zZ]$|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z",
        ).toLocaleString();
      };
    case "Time":
      return (v) => new Date("1970-01-01T" + v).toLocaleTimeString();
    case "Bool":
      return (v) => (v ? "Yes" : "No");
    default:
      return undefined;
  }
}

function actionVariantOf(s: AnyDef["actionStyle"]) {
  return s === "Secondary" ? "secondary" : s === "Link" ? "link" : "primary";
}

/**
 * The Dialog group's translation needs state — the `open` control — and a
 * handler for its subtree, so it is a component rather than a bare element.
 */
function DialogGroup({
  title,
  placements,
  hidden,
  className,
  retranslate,
}: {
  title?: string;
  placements: (string | null | undefined)[];
  hidden?: FormProp<boolean | undefined>;
  className?: FormProp<ClassValue>;
  retranslate: (opts: Partial<LoaderOptions>) => ReactNode[];
}) {
  const ctx = useControlContext();
  const open = useMemo(() => ctx.newControl(false), [ctx]);
  const kids = useMemo(() => {
    const nodes = retranslate({
      actionHandler: (id) =>
        id === "openDialog"
          ? () => ctx.update((wc) => wc.setValue(open, true))
          : id === "closeDialog"
            ? () => ctx.update((wc) => wc.setValue(open, false))
            : undefined,
    });
    const trigger: ReactNode[] = [];
    const body: ReactNode[] = [];
    placements.forEach((p, i) =>
      (p === "trigger" ? trigger : body).push(nodes[i]),
    );
    return { trigger, body };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retranslate, ctx, open]);
  return (
    <>
      {kids.trigger}
      <Dialog
        open={open}
        onClose={() => ctx.update((wc) => wc.setValue(open, false))}
        title={title}
        hidden={hidden}
        className={className}
      >
        {kids.body}
      </Dialog>
    </>
  );
}

/** A `Tooltip` adornment's text, which a display translates to its accessible name. */
function tooltipOf(def: AnyDef): string | undefined {
  const a = def.adornments?.find((a) => a.type === "Tooltip");
  return typeof a?.tooltip === "string" ? a.tooltip : undefined;
}

const handledDynamic = new Set([
  "Visible",
  "Disabled",
  "Label",
  "ActionData",
  "DefaultValue",
]);

/**
 * Keys a *parent* translator reads off a child definition, which the child's
 * own recording proxy cannot see: a Dialog group reads `placement`.
 */
const parentReadKeys = new Set(["placement"]);

/**
 * Everything a definition carries that no translator will read. Each of these
 * is silent without the warning — the control still renders, just without the
 * behaviour the JSON asked for, which is the failure mode that is hard to
 * notice and easy to ship.
 */
function warnUnhandled(
  def: AnyDef,
  warn: Warn,
  seen: Set<string>,
  hostAdornments: Set<string>,
  renderTypes: readonly string[] = [],
  dynamics: readonly string[] = [],
): void {
  const subject = def.title ?? def.field;
  const handled = new Set(renderTypes);
  const handledHere = new Set(dynamics);

  for (const a of def.adornments ?? []) {
    // A host entry is asked in `translate`, and reports there if it declines.
    if (hostAdornments.has(a.type)) continue;
    // Tooltip on a display is consumed by the display translator as its
    // accessible name; anywhere else it has no meaning and is reported.
    if (a.type === "Tooltip" && def.type === "Display") continue;
    // HelpText on a data control is the `helpText` prop (buildProps).
    if (a.type === "HelpText" && def.type === "Data") continue;
    // Icon at a control's edge on a data control is startIcon / endIcon.
    if (
      a.type === "Icon" &&
      def.type === "Data" &&
      (a.placement === "ControlStart" || a.placement === "ControlEnd")
    )
      continue;
    markSeen(seen, `adornments.${a.type}`, a);
    warn({
      kind: "adornment",
      subject,
      detail: `no translator for adornment "${a.type}" — it is dropped`,
    });
  }

  for (const d of def.dynamic ?? []) {
    if (!handledDynamic.has(d.type) && !handledHere.has(d.type)) {
      markSeen(seen, `dynamic.${d.type}`, d);
      warn({
        kind: "dynamic",
        subject,
        detail: `no translator for dynamic property "${d.type}" — the value stays static`,
      });
    }
  }

  const ro = def.renderOptions?.type;
  if (ro && !handled.has(ro))
    warn({
      kind: "renderOptions",
      subject,
      detail: `renderOptions "${ro}" is not understood — the default widget renders instead`,
    });

  const go = def.groupOptions?.type;
  if (go && !handled.has(go))
    warn({
      kind: "renderOptions",
      subject,
      detail: `groupOptions "${go}" is not understood — the children render unwrapped`,
    });

  // A compound rendered as a group nests the group kind under renderOptions.
  const ngo = (def.renderOptions?.groupOptions as { type?: string } | undefined)
    ?.type;
  if (ngo && !handled.has(ngo))
    warn({
      kind: "renderOptions",
      subject,
      detail: `renderOptions.groupOptions "${ngo}" is not understood — the children render as a plain group`,
    });
}

export function translate(
  ctx: ControlContext,
  scope: DataScope,
  rawDef: ControlDefinition,
  key: string,
  opts: LoaderOptions,
  collect: Collect = noCollect,
  /** Filled with the props built for `rawDef` — what a parent's `childProps` reads. */
  out?: { props?: FieldProps<any> },
): ReactNode {
  const translators = opts.translators ?? defaultTranslators;
  const hostAdornments = new Set(Object.keys(opts.adornments ?? {}));
  const icon = opts.icon ?? defaultIcon;
  const seen = new Set<string>();
  const def = recording(asDef(rawDef), seen);
  // `a/b` and `../x` resolve here — data and schema together, legacy's
  // `dataRef` — so a translator only ever sees a control.
  const ref = def.field ? resolveRef(scope, def.field) : undefined;
  const schema = asField(ref?.schema);
  const at: Warn = (w) =>
    collect({ ...w, subject: w.subject ?? undefined, path: key });
  // A custom display is addressed by id, not matched by shape: the host's
  // map is consulted before the translators, and stands in as one.
  const customId =
    def.type === "Display" && def.displayData?.type === "Custom"
      ? (str(def.displayData.customId) ?? "")
      : undefined;
  const hostDisplay =
    customId !== undefined ? opts.displays?.[customId] : undefined;
  const t: Translator | undefined = hostDisplay
    ? { match: () => true, render: hostDisplay, dynamics: ["Display"] }
    : translators.find((t) => t.match(def, schema));
  // `LayoutStyle` is consumed here or reported here — see `layoutStyle.tsx`.
  const layoutExpr = def.dynamic?.find((d) => d.type === "LayoutStyle")?.expr;
  const layoutToggle =
    layoutExpr?.type === "Jsonata" &&
    displayToggle((layoutExpr as AnyExpr).expression as string)
      ? toValueProp(ctx, scope, layoutExpr, (detail) =>
          at({ kind: "expression", subject: def.title ?? def.field, detail }),
        )
      : undefined;
  warnUnhandled(def, at, seen, hostAdornments, t?.renderTypes, [
    ...(t?.dynamics ?? []),
    "LayoutStyle",
  ]);
  if (layoutExpr && !layoutToggle)
    at({
      kind: "dynamic",
      subject: def.title ?? def.field,
      detail:
        "LayoutStyle that is not a display toggle — an inline style has no contract slot; style the state in the theme. Dropped",
    });

  // The children's data context: into the bound field, or unchanged. A
  // collection's children live in a *row*, so the eager pass — which exists to
  // collect their warnings once — walks them against a representative row
  // scope over a detached control; the rows themselves are translated at
  // render time by `element`.
  const childScope = !ref
    ? scope
    : schema?.collection
      ? elementScope(
          ref.scope,
          ref.name,
          ref.schema,
          ctx.newControl<unknown>(undefined),
          0,
        )
      : ref.into;

  // An action's click: the host's resolver, asked now with the static payload
  // so an unclaimed id is a warning here rather than a dead button there. A
  // dynamic `ActionData` is read again at click time, untracked.
  let onClick: (() => void | Promise<void>) | undefined;
  if (def.type === "Action" && def.actionId) {
    const id = def.actionId;
    const dyn = def.dynamic?.find((d) => d.type === "ActionData")?.expr;
    const dataProp = dyn ? toValueProp(ctx, scope, dyn) : undefined;
    // Read unconditionally: it is consumed whether or not a handler exists.
    const staticData = def.actionData ?? undefined;
    const resolved = opts.actionHandler?.(id, staticData);
    if (!resolved)
      at({
        kind: "action",
        subject: def.title ?? id,
        detail: `no handler claimed action "${id}" — the button does nothing`,
      });
    else
      onClick = dataProp
        ? () => opts.actionHandler!(id, getProp(untrackedRead, dataProp))?.()
        : resolved;
  }

  // A container may rebuild its children under a handler of its own; the
  // enclosing handler is the fall-through, so a Dialog claims two ids and
  // the host keeps the rest.
  const retranslate = (
    over: Partial<LoaderOptions> = {},
    rebuild: RetranslateRebuild = {},
  ): ReactNode[] => {
    const inner = over.actionHandler;
    const merged: LoaderOptions = {
      ...opts,
      ...over,
      actionHandler: inner
        ? (id, d) => inner(id, d) ?? opts.actionHandler?.(id, d)
        : opts.actionHandler,
    };
    const base = rebuild.at === "own" ? scope : childScope;
    const v = rebuild.variables;
    const s = v ? withVariables(base, v.values, v.key) : base;
    const quiet = rebuild.collectWarnings === false;
    return (rawDef.children ?? []).map((c, i) =>
      translate(ctx, s, c, `${key}.${i}`, merged, quiet ? noCollect : collect),
    );
  };

  const dynamicValue = (type: string): FormProp<unknown> | undefined => {
    const e = def.dynamic?.find((d) => d.type === type)?.expr;
    return e
      ? toValueProp(ctx, scope, e, (detail) =>
          at({ kind: "expression", subject: def.title ?? def.field, detail }),
        )
      : undefined;
  };

  if (def.field && !ref)
    at({
      kind: "schema",
      subject: def.field,
      detail: `field reference "${def.field}" walks off the data — bound to nothing`,
    });
  else if (def.field && !schema)
    at({
      kind: "schema",
      subject: def.field,
      detail: `no schema field named "${def.field}"`,
    });
  let props = buildProps(ctx, scope, def, ref, at, seen, hostAdornments, icon);

  // The host's adornments, both phases. An entry that declines both — or
  // has neither — leaves the adornment dropped, and that is reported like
  // any other. Wrapping folds in definition order, so the last is outermost.
  const hosted = (def.adornments ?? [])
    .filter((a) => hostAdornments.has(a.type))
    .map((a) => ({ a, h: opts.adornments![a.type], took: false }));
  for (const e of hosted) {
    const next = e.h.props?.(e.a, props, def);
    if (next) {
      props = next;
      e.took = true;
    }
  }
  if (out) out.props = props;
  const wrapHosted = (node: ReactNode): ReactNode => {
    for (const e of hosted) {
      const next = e.h.wrap?.(e.a, node, def);
      if (next !== undefined) {
        node = next;
        e.took = true;
      }
    }
    for (const e of hosted)
      if (!e.took) {
        markSeen(seen, `adornments.${e.a.type}`, e.a);
        at({
          kind: "adornment",
          subject: def.title ?? def.field,
          detail: `the host's "${e.a.type}" adornment declined this control — it is dropped`,
        });
      }
    return node;
  };

  const childOut = (t?.ownsChildren ? [] : (def.children ?? [])).map(
    () => ({}) as { props?: FieldProps<any> },
  );
  const children = (t?.ownsChildren ? [] : (def.children ?? [])).map((c, i) =>
    translate(ctx, childScope, c, `${key}.${i}`, opts, collect, childOut[i]),
  );
  const childProps = childOut.map((o) => o.props);

  const element =
    schema?.collection && ref
      ? (item: Control<any>, index: number) => (
          <>
            {(def.children ?? []).map((c, i) => (
              <ElementChild
                key={i}
                ctx={ctx}
                scope={elementScope(
                  ref.scope,
                  ref.name,
                  ref.schema,
                  item,
                  index,
                )}
                def={c}
                path={`${key}.${i}`}
                opts={opts}
              />
            ))}
          </>
        )
      : undefined;

  if (!t) {
    at({
      kind: "control",
      subject: def.title ?? def.field,
      detail:
        customId !== undefined
          ? `no host display for customId "${customId}"`
          : `no translator matched ${def.type}${
              def.displayData?.type ? ` / ${def.displayData.type}` : ""
            }${def.renderOptions?.type ? ` / ${def.renderOptions.type}` : ""}`,
    });
    const node = wrapHosted((opts.onUnsupported ?? defaultUnsupported)(def));
    warnUnread(asDef(rawDef), seen, at);
    return <TranslatedKey key={key}>{node}</TranslatedKey>;
  }
  const propReads = new Set<string>();
  const node = wrapHosted(
    t.render({
      def,
      schema,
      props: recordingProps(props, propReads),
      children,
      childProps,
      element,
      onClick,
      retranslate,
      dynamicValue,
      icon,
    }),
  );
  warnUnread(asDef(rawDef), seen, at);
  warnDropped(props, propReads, asDef(rawDef), at);
  const placed = layoutToggle ? (
    <Offscreen
      off={(rc) =>
        (getProp(rc, layoutToggle) as { display?: string } | null | undefined)
          ?.display === "none"
      }
    >
      {node}
    </Offscreen>
  ) : (
    node
  );
  return <TranslatedKey key={key}>{placed}</TranslatedKey>;
}

/**
 * The whole tree, plus everything the loader could not carry across.
 *
 * Warnings are gathered on this one walk. A translator is never handed the
 * collector — it reports nothing, because a translator that *matched* has by
 * definition understood the definition; the gaps are all in what no translator
 * claimed, and that is knowable here.
 */
export function translateForm(
  ctx: ControlContext,
  data: Control<unknown>,
  fields: SchemaField[],
  controls: ControlDefinition[],
  opts: LoaderOptions,
): { tree: ReactNode[]; warnings: LoaderWarning[] } {
  const warnings: LoaderWarning[] = [];
  const root = rootScope(ctx, data, fields);
  const tree = controls.map((c, i) =>
    translate(ctx, root, c, String(i), opts, (w) => warnings.push(w)),
  );
  return { tree, warnings };
}

/**
 * Legacy's data cycle for a control no field boundary owns — a compound
 * rendered as a group. Legacy cleared the compound's *own* value when hidden
 * (`address: undefined`, not `{ street: undefined, … }`) and defaulted it
 * when shown; a v2 group boundary has no binding and does neither, so the
 * loader does both here, over the compound's control, from inside the
 * group's scope.
 */
export function CompoundCycle({
  control,
  value,
  hidden,
  dontClearHidden,
}: {
  control: Control<unknown>;
  value: FormProp<unknown> | undefined;
  hidden: FormProp<boolean | undefined> | undefined;
  dontClearHidden: boolean | undefined;
}) {
  const scope = useFormScope();
  const ctx = useControlContext();
  useEffect(() => {
    if (!scope.clearHidden || dontClearHidden) return;
    const h = effect(ctx, (rc) => {
      if (scope.presence(rc) !== "hidden") return;
      if (rc.getValue(control) === undefined) return;
      ctx.update((wc) => wc.setValue(control, undefined));
    });
    return () => h.cleanup();
  }, [ctx, control, scope, dontClearHidden]);
  useDefaultValue(control, value, scope, true, hidden);
  return null;
}

/**
 * The Add below an array. Outside the collection boundary, so it takes the
 * array's `hidden` itself; the lock comes through the scope, as for any
 * `arrayActions` caller.
 */
function ArrayAdd({
  control,
  bounds,
  actionId,
  text,
  value,
  hidden,
}: {
  control: Control<unknown[]>;
  bounds: { minLength?: number; maxLength?: number };
  actionId: string;
  text: string;
  value: unknown;
  hidden?: FormProp<boolean | undefined>;
}): Rendered {
  const { rc, rendered } = useReactive();
  const ctx = useControlContext();
  const scope = useFormScope();
  const actions = arrayActions(rc, ctx, control, { ...bounds, scope });
  return rendered(
    <Action
      actionId={actionId}
      text={text}
      variant="primary"
      hidden={hidden}
      disabled={!actions.canAdd}
      onClick={() => actions.add(value)}
    />,
  );
}

function TranslatedKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function ElementChild({
  ctx,
  scope,
  def,
  path,
  opts,
}: {
  ctx: ControlContext;
  scope: DataScope;
  def: ControlDefinition;
  path: string;
  opts: LoaderOptions;
}) {
  return <>{translate(ctx, scope, def, path, opts)}</>;
}
