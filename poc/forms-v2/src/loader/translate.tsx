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

  const validate: Record<string, Validator<any>> = {};
  for (const v of def.validators ?? []) {
    if (v.type === "Length" && !schema?.collection) {
      validate.length = (value) => {
        const n = typeof value === "string" ? value.length : 0;
        if (v.min !== undefined && n < v.min) return `At least ${v.min}`;
        if (v.max !== undefined && n > v.max) return `At most ${v.max}`;
        return null;
      };
    }
  }

  const hiddenFromExpr: FormProp<boolean> | undefined = visible
    ? (rc) => !getProp(rc, toFormProp(ctx, data, visible))
    : undefined;

  return {
    field: createFormField(control),
    label: label
      ? (rc) => getProp(rc, toValueProp(ctx, data, label)) as ReactNode
      : (schema?.displayName ?? def.title),
    required: def.required,
    requiredMessage: def.requiredErrorText,
    hidden: hiddenFromExpr ?? def.hidden,
    disabled: disabled ? toFormProp(ctx, data, disabled) : def.disabled,
    readOnly: def.readonly,
    dontClearHidden: def.dontClearHidden,
    validate: Object.keys(validate).length ? validate : undefined,
  };
}

export function translate(
  ctx: ControlContext,
  data: Control<unknown>,
  fields: SchemaField[],
  def: ControlDefinition,
  key: string,
  opts: LoaderOptions,
): ReactNode {
  const translators = opts.translators ?? defaultTranslators;
  const schema = def.field ? findField(fields, def.field) : undefined;
  const props = buildProps(ctx, data, def, schema);

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
  if (!t) return (opts.onUnsupported ?? defaultUnsupported)(def);
  return (
    <TranslatedKey key={key}>
      {t.render({ def, schema, props, children, element })}
    </TranslatedKey>
  );
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
