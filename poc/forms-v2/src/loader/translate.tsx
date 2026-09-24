import { useMemo, type ReactNode } from "react";
import {
  untrackedRead,
  type Control,
  type ControlContext,
} from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  Contents,
  Dialog,
  DisplayOnlyField,
  Elements,
  getProp,
  HtmlDisplay,
  IconDisplay,
  RadioField,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  type ClassValue,
  type FieldOption,
  type FieldProps,
  type FormProp,
  type Validator,
} from "../framework/index.js";
import { toFormProp, toValueProp, jsonataValidator } from "./expressions.js";
import type { ControlDefinition, SchemaField } from "./json.js";
import {
  elementScope,
  resolveRef,
  rootScope,
  withVariables,
  type DataScope,
  type ResolvedRef,
} from "./scope.js";

/**
 * What the loader could not carry across.
 *
 * **Returned, not logged.** Open decision 2 in `FORMS-V2-GOALS.md` asks what a
 * loader does with JSON it cannot translate, and calls it a policy question —
 * so the loader's job is to *find* the gaps and the host's is to decide what
 * they mean. A console warning forecloses that: it is invisible in production,
 * unavailable to a test, and impossible for a designer to render next to the
 * control it is about. A list can be logged, rendered, asserted on in a
 * fixture, or turned into a build failure over a form corpus.
 *
 * `path` is the definition's position in the tree (`"3.1.0"`), which is also
 * the React key the translated node gets — so a host can line a warning up
 * with what rendered.
 */
export interface LoaderWarning {
  path: string;
  kind:
    | "control"
    | "renderOptions"
    | "adornment"
    | "dynamic"
    | "validator"
    | "expression"
    /** The definition names a field the supplied schema does not have — an input gap, not a loader one. */
    | "schema"
    /** A property on the definition that nothing — loader or translator — ever read. */
    | "unread"
    /** An action id no handler claimed — the button renders and does nothing. */
    | "action";
  /** `def.title` or the bound field, for a human reading the list. */
  subject?: string;
  detail: string;
}

/** Scoped to one definition — the walk supplies the `path`. */
type Warn = (w: Omit<LoaderWarning, "path">) => void;
type Collect = (w: LoaderWarning) => void;

/**
 * Collected once, during the memoised walk. A collection re-translates its
 * children per element at render time, over definitions the walk has already
 * seen, so that pass collects nothing rather than reporting each gap once per
 * row. See `translateForm`.
 */
const noCollect: Collect = () => {};

export interface TranslateArgs {
  def: ControlDefinition;
  schema?: SchemaField;
  /** Built by the loader. A translator never binds one. */
  props: FieldProps<any>;
  children: ReactNode[];
  /** For a collection: the children, rendered against one element. */
  element?: (item: Control<any>, index: number) => ReactNode;
  /** For an action: the click the host's `actionHandler` resolved, if any. */
  onClick?: () => void | Promise<void>;
  /**
   * For a container that needs its children built under different options —
   * a Dialog group claims `openDialog` / `closeDialog` for its subtree. The
   * given handler is consulted first; the enclosing one is the fall-through.
   */
  retranslate?: (
    opts: Partial<LoaderOptions>,
    /**
     * Rebuild the children somewhere else in the data. A radio's per-option
     * children bind the *parent* scope with per-option bindings, as legacy
     * did; `child` is the default, `own` the scope this definition sits in,
     * `field` its bound control.
     */
    scope?: (
      child: DataScope,
      own: DataScope,
      field: Control<unknown> | undefined,
    ) => DataScope,
    /** Skip warning collection — the children were already walked once. */
    quiet?: boolean,
  ) => ReactNode[];
  /**
   * A `dynamic` entry as a value prop — for the ones that are not field props:
   * a Display control's `Display` override. A translator that consumes one
   * lists it in `dynamics`, or it is reported as dropped.
   */
  dynamicValue: (type: string) => FormProp<unknown> | undefined;
}

export interface Translator {
  match(def: ControlDefinition, schema?: SchemaField): boolean;
  render(a: TranslateArgs): ReactNode;
  /**
   * The `renderOptions.type` / `groupOptions.type` values this translator
   * gives meaning to. Anything else on a matched definition is reported as a
   * discriminator the loader fell back on — so a translator that handles
   * `Standard` and `Multiline` says so, and `Radio` on the same field is a
   * warning rather than a silent `<input>`.
   */
  renderTypes?: string[];
  /** The `dynamic` property types this translator reads through `dynamicValue`. */
  dynamics?: string[];
  /**
   * The translator builds its children itself through `retranslate` — a
   * Dialog group, whose children need its handler. The loader then skips its
   * eager pass, or every child would be translated twice and warned twice.
   */
  ownsChildren?: boolean;
}

/**
 * How a button in a *loaded* form reaches host code. JSON cannot write a
 * closure, so the format gives a button an id and a payload; the host pairs
 * them here. Legacy's resolver shape (`ControlRenderOptions.actionHandler`):
 * asked once per button, returns the click or `undefined` to decline — which
 * is what lets the loader report an unclaimed id at translate time instead of
 * shipping a button that silently does nothing. Loader-only: `ActionProps`
 * has `onClick`, and this is what the loader builds it from.
 */
export type ActionHandler = (
  actionId: string,
  actionData: unknown,
) => (() => void | Promise<void>) | undefined;

export interface LoaderOptions {
  translators?: Translator[];
  onUnsupported?: (def: ControlDefinition) => ReactNode;
  actionHandler?: ActionHandler;
}

const defaultUnsupported = (def: ControlDefinition) => (
  <p className="ff-unsupported">
    Unsupported: {def.type}
    {def.renderOptions?.type ? ` / ${def.renderOptions.type}` : ""}
  </p>
);

const hasDynamic = (d: ControlDefinition, t: string) =>
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
  schema: SchemaField | undefined,
  dynamicValue: TranslateArgs["dynamicValue"],
): FormProp<FieldOption[]> | undefined {
  const all = schema?.options ?? [];
  const allowed = dynamicValue("AllowedOptions");
  if (!allowed) return all.length ? all : undefined;
  return (rc) => allowedOptions(all, getProp(rc, allowed));
}

const hasOptions = (d: ControlDefinition, s?: SchemaField) =>
  !!s?.options?.length || hasDynamic(d, "AllowedOptions");

/** The built-in translators, in match order. */
export const defaultTranslators: Translator[] = [
  {
    match: (d) => d.type === "Action",
    render: ({ def, props, children, onClick }) => (
      <Action
        actionId={def.actionId ?? "action"}
        text={def.actionText ?? def.title}
        onClick={onClick}
        hidden={props.hidden}
        disabled={props.disabled}
        className={props.className}
        textClassName={props.textClassName}
        style={actionStyleOf(def.actionStyle)}
        icon={
          def.icon?.name ? (
            <span aria-hidden>{glyph(def.icon.name)}</span>
          ) : undefined
        }
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
      const text = def.displayData?.text;
      return (
        <TextDisplay
          text={
            (dynamicValue("Display") as FormProp<ReactNode> | undefined) ?? text
          }
          hidden={props.hidden}
          className={props.className}
          textClassName={props.textClassName}
        />
      );
    },
  },
  {
    match: (d) => d.type === "Display" && d.displayData?.type === "Html",
    dynamics: ["Display"],
    render: ({ def, props, dynamicValue }) => {
      const html = def.displayData?.html;
      return (
        <HtmlDisplay
          html={
            (dynamicValue("Display") as FormProp<string> | undefined) ?? html
          }
          hidden={props.hidden}
          className={props.className}
          textClassName={props.textClassName}
        />
      );
    },
  },
  {
    // The one display whose accessible name is load-bearing — and where the
    // legacy `Tooltip` adornment lands (goals doc, open decision 1).
    match: (d) => d.type === "Display" && d.displayData?.type === "Icon",
    render: ({ def, props }) => (
      <IconDisplay
        icon={def.displayData?.icon?.name}
        accessibleName={tooltipOf(def)}
        hidden={props.hidden}
        className={props.className}
        textClassName={props.textClassName}
      />
    ),
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
    // context the children's `../x` refs climb out of.
    match: (d, s) =>
      d.type === "Data" && s?.type === "Compound" && !s.collection,
    renderTypes: ["Standard", "Group"],
    render: ({ props, children }) => (
      <Contents
        hidden={props.hidden}
        disabled={props.disabled}
        title={props.label}
        className={props.className}
      >
        {children}
      </Contents>
    ),
  },
  {
    match: (d, s) => d.type === "Data" && !!s?.collection,
    renderTypes: ["Standard", "Array"],
    render: ({ props, element, def }) => {
      const len = def.validators?.find((v) => v.type === "Length");
      const collectionProps = props as FieldProps<unknown[]>;
      return (
        <Elements
          {...collectionProps}
          minLength={len?.min}
          maxLength={len?.max}
          empty={<p className="ff-empty">Nothing yet.</p>}
        >
          {(item, index) => element!(item, index)}
        </Elements>
      );
    },
  },
  {
    // Radio, with legacy's per-option children: the definition's children
    // are translated once per option against the *parent* scope, with
    // `$formData.option` / `$formData.optionSelected` bound — what the
    // corpus's six radios-with-children read. Warnings are collected on the
    // first option's pass only.
    match: (d, s) =>
      d.type === "Data" &&
      d.renderOptions?.type === "Radio" &&
      hasOptions(d, s),
    renderTypes: ["Radio"],
    dynamics: ["AllowedOptions"],
    ownsChildren: true,
    render: ({ def, props, schema, retranslate, dynamicValue }) => {
      const ro = (def.renderOptions ?? {}) as Record<string, unknown>;
      // Per-option children are built over the *schema's* options — the
      // static set an `AllowedOptions` filter narrows at render time. An
      // expression that invents options the schema lacks gets no children
      // for them; legacy expanded children from the same static list.
      const options = schema?.options ?? [];
      const hasChildren = !!def.children?.length;
      const perOption = new Map(
        options.map((o, i) => [
          String(o.value),
          hasChildren
            ? retranslate!(
                {},
                (_child, own, field) =>
                  withVariables(
                    own,
                    (rc) => ({
                      formData: {
                        option: o,
                        optionSelected:
                          field !== undefined &&
                          String(rc.getValue(field)) === String(o.value),
                      },
                    }),
                    `option:${String(o.value)}`,
                  ),
                i > 0,
              )
            : [],
        ]),
      );
      return (
        <RadioField
          {...props}
          options={optionsFor(schema, dynamicValue)}
          entryClassName={toClassValue(ro.entryWrapperClass as string)}
          selectedClassName={toClassValue(ro.selectedClass as string)}
          notSelectedClassName={toClassValue(ro.notSelectedClass as string)}
        >
          {hasChildren
            ? (o) => <>{perOption.get(String(o.value))}</>
            : undefined}
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
      />
    ),
  },
  {
    match: (d) => d.type === "Group" && d.groupOptions?.type === "Tabs",
    renderTypes: ["Tabs"],
    render: ({ def, props, children }) => (
      <Tabs
        items={(def.children ?? []).map((c, i) => ({
          key: c.title ?? String(i),
          title: c.title ?? `Tab ${i + 1}`,
          children: children[i],
        }))}
        hidden={props.hidden}
        className={props.className}
      />
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
      >
        {children}
      </Contents>
    ),
  },
];

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
  def: ControlDefinition,
  ref: ResolvedRef | undefined,
  warn: Warn,
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

  const expr: (detail: string) => void = (detail) =>
    warn({ kind: "expression", subject: def.field ?? def.title, detail });

  const validate: Record<string, Validator<any>> = {};
  let jsonataN = 0;
  for (const v of def.validators ?? []) {
    if (v.type === "Jsonata") {
      // An async validator (§5): the expression yields the message, against
      // the parent data. Keyed like legacy's `jsonata`, numbered past the first.
      const fn = jsonataValidator(scope, v.expression, expr);
      if (fn) validate[jsonataN ? `jsonata${jsonataN}` : "jsonata"] = fn;
      jsonataN++;
      continue;
    }
    if (v.type !== "Length") {
      warn({
        kind: "validator",
        subject: def.field ?? def.title,
        detail: `no translator for validator "${(v as { type: string }).type}" — the rule is not enforced`,
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
    if (v.type === "Length" && !schema?.collection) {
      validate.length = (value) => {
        const n = typeof value === "string" ? value.length : 0;
        if (v.min !== undefined && n < v.min) return `At least ${v.min}`;
        if (v.max !== undefined && n > v.max) return `At most ${v.max}`;
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

  const hiddenFromExpr: FormProp<boolean> | undefined = visibleProp
    ? (rc) => !getProp(rc, visibleProp)
    : undefined;

  // `hideTitle` is legacy's "render no label"; a group keeps the same flag
  // under `groupOptions`. Read both so the audit sees them either way.
  const hideTitle =
    def.hideTitle === true ||
    (def.type === "Group" && def.groupOptions?.hideTitle === true);

  return {
    field: control,
    label: hideTitle
      ? undefined
      : labelProp
        ? (rc) => getProp(rc, labelProp) as ReactNode
        : (def.title ?? schema?.displayName),
    required: def.required,
    requiredMessage: def.requiredErrorText,
    hidden: hiddenFromExpr ?? def.hidden,
    disabled: disabledProp ?? def.disabled,
    readOnly: def.readonly,
    dontClearHidden: def.dontClearHidden,
    validate: Object.keys(validate).length ? validate : undefined,
    className: toClassValue(def.styleClass),
    textClassName: toClassValue(def.textClass),
    shellClassName: toClassValue(def.layoutClass),
    labelClassName: toClassValue(def.labelClass),
    labelTextClassName: toClassValue(def.labelTextClass),
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
): T {
  return new Proxy(target, {
    get(t, prop, r) {
      if (typeof prop === "string") {
        seen.add(prefix + prop);
        const v = Reflect.get(t, prop, r);
        if (
          !prefix &&
          (nestedKeys as readonly string[]).includes(prop) &&
          v &&
          typeof v === "object"
        )
          return recording(v as object, seen, prop + ".");
        return v;
      }
      return Reflect.get(t, prop, r);
    },
  });
}

function warnUnread(def: ControlDefinition, seen: Set<string>, warn: Warn) {
  const subject = def.title ?? def.field;
  const report = (path: string) =>
    warn({
      kind: "unread",
      subject,
      detail: `"${path}" is not read by any translator — dropped`,
    });
  for (const [k, v] of Object.entries(def)) {
    if (!meaningful(v) || parentReadKeys.has(k)) continue;
    if (!seen.has(k)) report(k);
    else if (
      (nestedKeys as readonly string[]).includes(k) &&
      typeof v === "object"
    )
      for (const [nk, nv] of Object.entries(v as object))
        if (meaningful(nv) && !seen.has(`${k}.${nk}`)) report(`${k}.${nk}`);
  }
}

/**
 * The four class slots (goals doc, decision 4): `styleClass` → the control,
 * `textClass` → its text, `layoutClass` → the shell, `labelClass` → the label.
 * Legacy spells *replace rather than merge* as an `"@ "` prefix inside the
 * string; the contract types it as `{ replace }`.
 */
function toClassValue(s: string | null | undefined): ClassValue | undefined {
  if (!s) return undefined;
  return s.startsWith("@ ") ? { replace: s.slice(2) } : s;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
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

function actionStyleOf(s: ControlDefinition["actionStyle"]) {
  return s === "Secondary" ? "secondary" : s === "Link" ? "link" : "primary";
}

const glyphs: Record<string, string> = {
  plus: "+",
  trash: "\u{1F5D1}",
  pen: "\u270E",
  check: "\u2713",
  xmark: "\u2715",
  "arrow-right": "\u2192",
  "arrow-left": "\u2190",
};
function glyph(name: string): string {
  return glyphs[name] ?? name;
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
  hidden?: FormProp<boolean>;
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
function tooltipOf(def: ControlDefinition): string | undefined {
  const a = def.adornments?.find((a) => a.type === "Tooltip");
  return typeof a?.tooltip === "string" ? a.tooltip : undefined;
}

const handledDynamic = new Set(["Visible", "Disabled", "Label", "ActionData"]);

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
  def: ControlDefinition,
  warn: Warn,
  renderTypes: readonly string[] = [],
  dynamics: readonly string[] = [],
): void {
  const subject = def.title ?? def.field;
  const handled = new Set(renderTypes);
  const handledHere = new Set(dynamics);

  for (const a of def.adornments ?? []) {
    // Tooltip on a display is consumed by the display translator as its
    // accessible name; anywhere else it has no meaning and is reported.
    if (a.type === "Tooltip" && def.type === "Display") continue;
    warn({
      kind: "adornment",
      subject,
      detail: `no translator for adornment "${a.type}" — it is dropped`,
    });
  }

  for (const d of def.dynamic ?? []) {
    if (!handledDynamic.has(d.type) && !handledHere.has(d.type))
      warn({
        kind: "dynamic",
        subject,
        detail: `no translator for dynamic property "${d.type}" — the value stays static`,
      });
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
}

export function translate(
  ctx: ControlContext,
  scope: DataScope,
  rawDef: ControlDefinition,
  key: string,
  opts: LoaderOptions,
  collect: Collect = noCollect,
): ReactNode {
  const translators = opts.translators ?? defaultTranslators;
  const seen = new Set<string>();
  const def = recording(rawDef, seen);
  // `a/b` and `../x` resolve here — data and schema together, legacy's
  // `dataRef` — so a translator only ever sees a control.
  const ref = def.field ? resolveRef(scope, def.field) : undefined;
  const schema = ref?.schema;
  const at: Warn = (w) => collect({ ...w, path: key });
  const t = translators.find((t) => t.match(def, schema));
  warnUnhandled(def, at, t?.renderTypes, t?.dynamics);

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
    over: Partial<LoaderOptions>,
    scopeFn?: (
      child: DataScope,
      own: DataScope,
      field: Control<unknown> | undefined,
    ) => DataScope,
    quiet = false,
  ): ReactNode[] => {
    const inner = over.actionHandler;
    const merged: LoaderOptions = {
      ...opts,
      ...over,
      actionHandler: inner
        ? (id, d) => inner(id, d) ?? opts.actionHandler?.(id, d)
        : opts.actionHandler,
    };
    const s = scopeFn ? scopeFn(childScope, scope, ref?.control) : childScope;
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
  const props = buildProps(ctx, scope, def, ref, at);

  const children = (t?.ownsChildren ? [] : (def.children ?? [])).map((c, i) =>
    translate(ctx, childScope, c, `${key}.${i}`, opts, collect),
  );

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
      detail: `no translator matched ${def.type}${
        def.displayData?.type ? ` / ${def.displayData.type}` : ""
      }${def.renderOptions?.type ? ` / ${def.renderOptions.type}` : ""}`,
    });
    const node = (opts.onUnsupported ?? defaultUnsupported)(def);
    warnUnread(rawDef, seen, at);
    return <TranslatedKey key={key}>{node}</TranslatedKey>;
  }
  const node = t.render({
    def,
    schema,
    props,
    children,
    element,
    onClick,
    retranslate,
    dynamicValue,
  });
  warnUnread(rawDef, seen, at);
  return <TranslatedKey key={key}>{node}</TranslatedKey>;
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
  const root = rootScope(data, fields);
  const tree = controls.map((c, i) =>
    translate(ctx, root, c, String(i), opts, (w) => warnings.push(w)),
  );
  return { tree, warnings };
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
