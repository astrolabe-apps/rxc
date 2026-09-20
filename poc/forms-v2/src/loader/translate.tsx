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
  createFormField,
  Elements,
  getProp,
  HtmlDisplay,
  IconDisplay,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  type ClassValue,
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
  element?: (item: FormField<any>) => ReactNode;
  /** For an action: the click the host's `actionHandler` resolved, if any. */
  onClick?: () => void | Promise<void>;
  /**
   * For a container that needs its children built under different options —
   * a Dialog group claims `openDialog` / `closeDialog` for its subtree. The
   * given handler is consulted first; the enclosing one is the fall-through.
   */
  retranslate?: (opts: Partial<LoaderOptions>) => ReactNode[];
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
    render: ({ def, props }) => (
      <TextDisplay
        text={def.displayData?.text}
        hidden={props.hidden}
        className={props.className}
        textClassName={props.textClassName}
      />
    ),
  },
  {
    match: (d) => d.type === "Display" && d.displayData?.type === "Html",
    render: ({ def, props }) => (
      <HtmlDisplay
        html={def.displayData?.html}
        hidden={props.hidden}
        className={props.className}
        textClassName={props.textClassName}
      />
    ),
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
          {(item) => element!(item)}
        </Elements>
      );
    },
  },
  {
    // Options come off the schema here and become a prop there; nothing below
    // this line knows a schema exists.
    match: (d, s) => d.type === "Data" && !!s?.options?.length,
    renderTypes: ["Standard", "Dropdown"],
    render: ({ props, schema }) => (
      <SelectField {...props} options={schema!.options} />
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
    className: toClassValue(def.styleClass),
    textClassName: toClassValue(def.textClass),
    shellClassName: toClassValue(def.layoutClass),
    labelClassName: toClassValue(def.labelClass),
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
): void {
  const subject = def.title ?? def.field;
  const handled = new Set(renderTypes);

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
    if (!handledDynamic.has(d.type))
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
  data: Control<unknown>,
  fields: SchemaField[],
  rawDef: ControlDefinition,
  key: string,
  opts: LoaderOptions,
  collect: Collect = noCollect,
): ReactNode {
  const translators = opts.translators ?? defaultTranslators;
  const seen = new Set<string>();
  const def = recording(rawDef, seen);
  const schema = def.field ? findField(fields, def.field) : undefined;
  const at: Warn = (w) => collect({ ...w, path: key });
  const t = translators.find((t) => t.match(def, schema));
  warnUnhandled(def, at, t?.renderTypes);

  const childFields = schema?.children ?? fields;
  const childData = def.field
    ? ((data as Control<Record<string, unknown>>).fields[
        def.field
      ] as Control<unknown>)
    : data;

  // An action's click: the host's resolver, asked now with the static payload
  // so an unclaimed id is a warning here rather than a dead button there. A
  // dynamic `ActionData` is read again at click time, untracked.
  let onClick: (() => void | Promise<void>) | undefined;
  if (def.type === "Action" && def.actionId) {
    const id = def.actionId;
    const dyn = def.dynamic?.find((d) => d.type === "ActionData")?.expr;
    const dataProp = dyn ? toValueProp(ctx, data, dyn) : undefined;
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
  const retranslate = (over: Partial<LoaderOptions>): ReactNode[] => {
    const inner = over.actionHandler;
    const merged: LoaderOptions = {
      ...opts,
      ...over,
      actionHandler: inner
        ? (id, d) => inner(id, d) ?? opts.actionHandler?.(id, d)
        : opts.actionHandler,
    };
    return (rawDef.children ?? []).map((c, i) =>
      translate(ctx, childData, childFields, c, `${key}.${i}`, merged, collect),
    );
  };

  if (def.field && !schema)
    at({
      kind: "schema",
      subject: def.field,
      detail: `no schema field named "${def.field}"`,
    });
  const props = buildProps(ctx, data, def, schema, at);

  const children = (t?.ownsChildren ? [] : (def.children ?? [])).map((c, i) =>
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
