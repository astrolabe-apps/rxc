import type { ReactNode } from "react";
import type { Control, ControlContext } from "@rx-controls/core";
import {
  Action,
  CheckboxField,
  Contents,
  createFormField,
  Elements,
  getProp,
  HtmlDisplay,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  type FieldProps,
  type FormField,
  type FormProp,
  type Validator,
} from "../framework/index.js";
import { toFormProp, toValueProp } from "./expressions.js";
import { findField, type ControlDefinition, type SchemaField } from "./json.js";

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
    | "expression";
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
  element?: (item: FormField<any>) => ReactNode;
}

export interface Translator {
  match(def: ControlDefinition, schema?: SchemaField): boolean;
  render(a: TranslateArgs): ReactNode;
}

export interface LoaderOptions {
  translators?: Translator[];
  onUnsupported?: (def: ControlDefinition) => ReactNode;
}

const defaultUnsupported = (def: ControlDefinition) => (
  <p className="ff-unsupported">
    Unsupported: {def.type}
    {def.renderOptions?.type ? ` / ${def.renderOptions.type}` : ""}
  </p>
);

/** The built-in translators, in match order. */
export const defaultTranslators: Translator[] = [
  {
    match: (d) => d.type === "Action",
    render: ({ def }) => (
      <Action
        actionId={def.actionId ?? "action"}
        text={def.actionText ?? def.title}
        style="primary"
      />
    ),
  },
  {
    match: (d) => d.type === "Display" && d.displayData?.type === "Text",
    render: ({ def, props }) => (
      <TextDisplay text={def.displayData?.text} hidden={props.hidden} />
    ),
  },
  {
    match: (d) => d.type === "Display" && d.displayData?.type === "Html",
    render: ({ def, props }) => (
      <HtmlDisplay html={def.displayData?.html} hidden={props.hidden} />
    ),
  },
  {
    match: (d, s) => d.type === "Data" && !!s?.collection,
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
          {(item) => element!(item)}
        </Elements>
      );
    },
  },
  {
    // Options come off the schema here and become a prop there; nothing below
    // this line knows a schema exists.
    match: (d, s) => d.type === "Data" && !!s?.options?.length,
    render: ({ props, schema }) => (
      <SelectField {...props} options={schema!.options} />
    ),
  },
  {
    match: (d, s) => d.type === "Data" && s?.type === "Bool",
    render: ({ props }) => <CheckboxField {...props} />,
  },
  {
    match: (d) => d.type === "Data",
    render: ({ props, def }) => (
      <TextField
        {...props}
        multiline={def.renderOptions?.type === "Multiline"}
      />
    ),
  },
  {
    match: (d) => d.type === "Group" && d.groupOptions?.type === "Tabs",
    render: ({ def, children }) => (
      <Tabs
        items={(def.children ?? []).map((c, i) => ({
          key: c.title ?? String(i),
          title: c.title ?? `Tab ${i + 1}`,
          children: children[i],
        }))}
      />
    ),
  },
  {
    match: (d) => d.type === "Group",
    render: ({ props, children }) => (
      <Contents hidden={props.hidden} disabled={props.disabled}>
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
  data: Control<unknown>,
  def: ControlDefinition,
  schema: SchemaField | undefined,
  warn: Warn,
): FieldProps<any> {
  const control = def.field
    ? ((data as Control<Record<string, unknown>>).fields[
        def.field
      ] as Control<unknown>)
    : data;
  const dyn = (t: string) => def.dynamic?.find((d) => d.type === t)?.expr;

  const visible = dyn("Visible");
  const disabled = dyn("Disabled");
  const label = dyn("Label");

  const expr: (detail: string) => void = (detail) =>
    warn({ kind: "expression", subject: def.field ?? def.title, detail });

  const validate: Record<string, Validator<any>> = {};
  for (const v of def.validators ?? []) {
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
    ? toFormProp(ctx, data, visible, expr)
    : undefined;
  const labelProp = label ? toValueProp(ctx, data, label, expr) : undefined;
  const disabledProp = disabled
    ? toFormProp(ctx, data, disabled, expr)
    : undefined;

  const hiddenFromExpr: FormProp<boolean> | undefined = visibleProp
    ? (rc) => !getProp(rc, visibleProp)
    : undefined;

  return {
    field: createFormField(control),
    label: labelProp
      ? (rc) => getProp(rc, labelProp) as ReactNode
      : (schema?.displayName ?? def.title),
    required: def.required,
    requiredMessage: def.requiredErrorText,
    hidden: hiddenFromExpr ?? def.hidden,
    disabled: disabledProp ?? def.disabled,
    readOnly: def.readonly,
    dontClearHidden: def.dontClearHidden,
    validate: Object.keys(validate).length ? validate : undefined,
  };
}

/** What the built-in translators actually read off `renderOptions`/`groupOptions`. */
const handledRenderOptions = new Set(["Standard", "Multiline"]);
const handledGroupOptions = new Set(["Standard", "Contents", "Tabs"]);
const handledDynamic = new Set(["Visible", "Disabled", "Label"]);

/**
 * Everything a definition carries that no translator will read. Each of these
 * is silent without the warning — the control still renders, just without the
 * behaviour the JSON asked for, which is the failure mode that is hard to
 * notice and easy to ship.
 */
function warnUnhandled(def: ControlDefinition, warn: Warn): void {
  const subject = def.title ?? def.field;

  for (const a of def.adornments ?? []) {
    const detail =
      a.type === "Tooltip" && def.type === "Display"
        ? `adornment "Tooltip" on a display translates to the display's accessible name, which this loader does not build yet`
        : `no translator for adornment "${a.type}" — it is dropped`;
    warn({ kind: "adornment", subject, detail });
  }

  for (const d of def.dynamic ?? []) {
    if (!handledDynamic.has(d.type))
      warn({
        kind: "dynamic",
        subject,
        detail: `no translator for dynamic property "${d.type}" — the value stays static`,
      });
  }

  const ro = def.renderOptions?.type;
  if (ro && !handledRenderOptions.has(ro))
    warn({
      kind: "renderOptions",
      subject,
      detail: `renderOptions "${ro}" is not understood — the default widget renders instead`,
    });

  const go = def.groupOptions?.type;
  if (go && !handledGroupOptions.has(go))
    warn({
      kind: "renderOptions",
      subject,
      detail: `groupOptions "${go}" is not understood — the children render unwrapped`,
    });
}

export function translate(
  ctx: ControlContext,
  data: Control<unknown>,
  fields: SchemaField[],
  def: ControlDefinition,
  key: string,
  opts: LoaderOptions,
  collect: Collect = noCollect,
): ReactNode {
  const translators = opts.translators ?? defaultTranslators;
  const schema = def.field ? findField(fields, def.field) : undefined;
  const at: Warn = (w) => collect({ ...w, path: key });
  warnUnhandled(def, at);
  if (def.field && !schema)
    at({
      kind: "control",
      subject: def.field,
      detail: `no schema field named "${def.field}"`,
    });
  const props = buildProps(ctx, data, def, schema, at);

  const childFields = schema?.children ?? fields;
  const childData = def.field
    ? ((data as Control<Record<string, unknown>>).fields[
        def.field
      ] as Control<unknown>)
    : data;

  const children = (def.children ?? []).map((c, i) =>
    translate(
      ctx,
      schema?.collection ? childData : childData,
      childFields,
      c,
      `${key}.${i}`,
      opts,
      collect,
    ),
  );

  const element = schema?.collection
    ? (item: FormField<any>) => (
        <>
          {(def.children ?? []).map((c, i) => (
            <ElementChild
              key={i}
              ctx={ctx}
              item={item}
              fields={childFields}
              def={c}
              path={`${key}.${i}`}
              opts={opts}
            />
          ))}
        </>
      )
    : undefined;

  const t = translators.find((t) => t.match(def, schema));
  if (!t) {
    at({
      kind: "control",
      subject: def.title ?? def.field,
      detail: `no translator matched ${def.type}${
        def.displayData?.type ? ` / ${def.displayData.type}` : ""
      }${def.renderOptions?.type ? ` / ${def.renderOptions.type}` : ""}`,
    });
    return (
      <TranslatedKey key={key}>
        {(opts.onUnsupported ?? defaultUnsupported)(def)}
      </TranslatedKey>
    );
  }
  return (
    <TranslatedKey key={key}>
      {t.render({ def, schema, props, children, element })}
    </TranslatedKey>
  );
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
  const tree = controls.map((c, i) =>
    translate(ctx, data, fields, c, String(i), opts, (w) => warnings.push(w)),
  );
  return { tree, warnings };
}

function TranslatedKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function ElementChild({
  ctx,
  item,
  fields,
  def,
  path,
  opts,
}: {
  ctx: ControlContext;
  item: FormField<any>;
  fields: SchemaField[];
  def: ControlDefinition;
  path: string;
  opts: LoaderOptions;
}) {
  return <>{translate(ctx, item.control, fields, def, path, opts)}</>;
}
