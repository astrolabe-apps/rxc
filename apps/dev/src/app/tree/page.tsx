"use client";

import { useMemo, useRef, useState } from "react";
import type { Control } from "@rxc/controls";
import { useControls, type Rendered, useControlContext, ControlContextProvider, createControlContext } from "@rxc/controls";
import type {
  ControlDefinition,
  FormStateNode,
  GroupedControlsDefinition,
  SchemaField,
  SchemaTreeResolver,
  FormTreeResolver,
} from "@rxc/forms-core";
import {
  buildSchema,
  compoundControl,
  compoundField,
  createDataNode,
  createReactiveFormTree,
  createStaticSchemaTree,
  dataControl,
  dataMatchExpr,
  groupedControl,
  intField,
  notExpr,
  stringField,
  withScripts,
} from "@rxc/forms-core";
import { Form, useFormStateNode } from "@rxc/forms";

// ── Shared helpers ───────────────────────────────────────────────────

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}
    >
      {children}
    </span>
  );
}

function ValueDisplay({ value }: { value: unknown }) {
  if (value === undefined)
    return <span className="text-zinc-400 italic">undefined</span>;
  if (value === null) return <span className="text-zinc-400 italic">null</span>;
  if (typeof value === "string")
    return (
      <span className="text-green-600 dark:text-green-400">
        &quot;
        {value.length > 40 ? value.slice(0, 40) + "..." : value}
        &quot;
      </span>
    );
  if (typeof value === "number")
    return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  if (typeof value === "boolean")
    return (
      <span className="text-purple-600 dark:text-purple-400">
        {value.toString()}
      </span>
    );
  if (Array.isArray(value))
    return <span className="text-zinc-500">[{value.length} items]</span>;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return (
      <span className="text-zinc-500">{`{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`}</span>
    );
  }
  return <span>{String(value)}</span>;
}

// ── Raw control tree inspector ──────────────────────────────────────

function ControlLeafNode({ control, name }: { control: Control<any>; name: string }): Rendered {
  const { rc, rendered } = useControls();
  const value = rc.getValue(control);
  const dirty = rc.isDirty(control);
  const touched = rc.isTouched(control);
  const disabled = rc.isDisabled(control);
  const valid = rc.isValid(control);
  const error = rc.getError(control);

  return rendered(
    <div className="flex items-center gap-1.5 py-0.5 px-1 font-mono text-xs">
      <span className="w-3" />
      <span className="text-zinc-900 dark:text-zinc-100">{name}</span>
      <span className="text-zinc-400">#{control.uniqueId}</span>
      <span className="mx-1 text-zinc-300 dark:text-zinc-600">=</span>
      <ValueDisplay value={value} />
      <span className="flex-1" />
      <span className="flex gap-1">
        {dirty && (
          <Badge color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            dirty
          </Badge>
        )}
        {touched && (
          <Badge color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
            touched
          </Badge>
        )}
        {disabled && (
          <Badge color="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
            disabled
          </Badge>
        )}
        {!valid && (
          <Badge color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            invalid
          </Badge>
        )}
        {error && <span className="text-red-500">{error}</span>}
      </span>
    </div>
  );
}

function ControlBranchNode({
    control,
    name,
    defaultExpanded,
  }: { control: Control<any>; name: string; defaultExpanded?: boolean }): Rendered {
  const { rc, rendered } = useControls();
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const value = rc.getValue(control);
  const dirty = rc.isDirty(control);
  const touched = rc.isTouched(control);
  const disabled = rc.isDisabled(control);
  const valid = rc.isValid(control);
  const error = rc.getError(control);

  const fieldEntries = Object.entries(control.fieldsNow);
  const elems = control.elementsNow;

  return rendered(
    <div className="font-mono text-xs">
      <div
        className="flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-3 text-center text-zinc-400">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="text-zinc-900 dark:text-zinc-100">{name}</span>
        <span className="text-zinc-400">#{control.uniqueId}</span>
        <span className="mx-1 text-zinc-300 dark:text-zinc-600">=</span>
        <ValueDisplay value={value} />
        <span className="flex-1" />
        <span className="flex gap-1">
          {dirty && (
            <Badge color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              dirty
            </Badge>
          )}
          {touched && (
            <Badge color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              touched
            </Badge>
          )}
          {disabled && (
            <Badge color="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              disabled
            </Badge>
          )}
          {!valid && (
            <Badge color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              invalid
            </Badge>
          )}
          {error && <span className="text-red-500">{error}</span>}
        </span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 16 }}>
          {fieldEntries.map(([key, child]) => (
            <ControlNodeRenderer key={key} control={child} name={`.${key}`} />
          ))}
          {elems.map((elem, i) => (
            <ControlNodeRenderer
              key={elem.uniqueId}
              control={elem}
              name={`[${i}]`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ControlNodeRenderer({
  control,
  name,
  defaultExpanded,
}: {
  control: Control<any>;
  name: string;
  defaultExpanded?: boolean;
}) {
  const fieldKeys = Object.keys(control.fieldsNow);
  const hasChildren = fieldKeys.length > 0 || control.elementsNow.length > 0;
  if (hasChildren) {
    return (
      <ControlBranchNode
        control={control}
        name={name}
        defaultExpanded={defaultExpanded}
      />
    );
  }
  return <ControlLeafNode control={control} name={name} />;
}

// ── FormStateNode tree inspector ────────────────────────────────────

function FormStateLeafNode({ node }: { node: FormStateNode }): Rendered {
  const { rc, rendered } = useControls();
  const {
    visible,
    disabled,
    readonly,
    data,
    definition: def,
  } = node.getState(rc);

  const dataValue = data ? rc.getValue(data) : undefined;
  const dataError = data ? rc.getError(data) : undefined;

  const visColor =
    visible === false
      ? "text-red-500"
      : visible === null
        ? "text-zinc-400"
        : "text-green-500";

  return rendered(
    <div className="flex items-center gap-1.5 py-0.5 px-1 font-mono text-xs">
      <span className="w-3" />
      <Badge
        color={
          def.type === "Data"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : def.type === "Group"
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
        }
      >
        {def.type}
      </Badge>
      {def.title && (
        <span className="text-zinc-400">&ldquo;{def.title}&rdquo;</span>
      )}
      {data && (
        <>
          <span className="text-zinc-300 dark:text-zinc-600">=</span>
          <ValueDisplay value={dataValue} />
        </>
      )}
      <span className="flex-1" />
      <span className="flex gap-1">
        <span className={visColor}>
          {visible === false
            ? "\u{1F441}\u2717"
            : visible === null
              ? "\u{1F441}?"
              : "\u{1F441}\u2713"}
        </span>
        {disabled && (
          <Badge color="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
            disabled
          </Badge>
        )}
        {readonly && (
          <Badge color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            readonly
          </Badge>
        )}
        {dataError && <span className="text-red-500">{dataError}</span>}
      </span>
    </div>
  );
}

function FormStateBranchNode({ node, defaultExpanded }: { node: FormStateNode; defaultExpanded?: boolean }): Rendered {
  const { rc, rendered } = useControls();
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);

  const {
    visible,
    disabled,
    readonly,
    data,
    definition: def,
  } = node.getState(rc);

  const dataValue = data ? rc.getValue(data) : undefined;
  const dataError = data ? rc.getError(data) : undefined;

  const visColor =
    visible === false
      ? "text-red-500"
      : visible === null
        ? "text-zinc-400"
        : "text-green-500";

  return rendered(
    <div className="font-mono text-xs">
      <div
        className="flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-3 text-center text-zinc-400">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <Badge
          color={
            def.type === "Data"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : def.type === "Group"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          }
        >
          {def.type}
        </Badge>
        {def.title && (
          <span className="text-zinc-400">&ldquo;{def.title}&rdquo;</span>
        )}
        {data && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">=</span>
            <ValueDisplay value={dataValue} />
          </>
        )}
        <span className="flex-1" />
        <span className="flex gap-1">
          <span className={visColor}>
            {visible === false
              ? "\u{1F441}\u2717"
              : visible === null
                ? "\u{1F441}?"
                : "\u{1F441}\u2713"}
          </span>
          {disabled && (
            <Badge color="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              disabled
            </Badge>
          )}
          {readonly && (
            <Badge color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              readonly
            </Badge>
          )}
          {dataError && <span className="text-red-500">{dataError}</span>}
        </span>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 16 }}>
          {node.getChildren(rc).map((child) => (
            <FormStateNodeRenderer key={child.uniqueId} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormStateNodeRenderer({
    node,
    defaultExpanded,
  }: {
    node: FormStateNode;
    defaultExpanded?: boolean;
  }): Rendered {
  const { rc, rendered } = useControls();
  const children = node.getChildren(rc);
  if (children.length > 0) {
    return rendered(
      <FormStateBranchNode node={node} defaultExpanded={defaultExpanded} />
    );
  }
  return rendered(<FormStateLeafNode node={node} />);
}

// ── Demo scenario ────────────────────────────────────────────────────

interface PersonData {
  type: string;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  address: { street: string; city: string; zip: string };
  company: string;
  taxId: string;
}

function personSchema(): SchemaField[] {
  return buildSchema<PersonData>({
    type: stringField("Type", { isTypeField: true }),
    firstName: stringField("First name"),
    lastName: stringField("Last name"),
    email: stringField("Email"),
    age: intField("Age"),
    address: compoundField(
      "Address",
      buildSchema<{ street: string; city: string; zip: string }>({
        street: stringField("Street"),
        city: stringField("City"),
        zip: stringField("ZIP"),
      }),
    ),
    // `company` — no `onlyForTypes` gate so the scripted `Disabled` rule
    // below is observable (otherwise visibility would hide it outright and
    // we'd never see the disabled state).
    company: stringField("Company"),
    // `taxId` — schema-level `onlyForTypes` so we can also see that rule
    // removing a field entirely when the discriminator doesn't match.
    taxId: stringField("Tax ID", { onlyForTypes: ["business"] }),
  });
}

function personFormDef(): GroupedControlsDefinition {
  return groupedControl(
    [
      dataControl("type", "Type (personal / business)"),
      dataControl("firstName", "First Name", { required: true }),
      dataControl("lastName", "Last Name"),
      dataControl("email", "Email", { required: true }),
      dataControl("age", "Age"),
      compoundControl("address", "Address", [
        dataControl("street", "Street"),
        dataControl("city", "City", { required: true }),
        dataControl("zip", "ZIP"),
      ]),
      // `company` — disabled when `type != "business"` via a $scripts
      // disabled binding. Stays visible so you can see the disabled state
      // flip in the UI.
      withScripts(dataControl("company", "Company (scripted disabled)"), {
        disabled: notExpr(dataMatchExpr("../type", "business")),
      }),
      // `taxId` — onlyForTypes on the schema field; entirely hidden when
      // `type != "business"`.
      dataControl("taxId", "Tax ID (business only, onlyForTypes)"),
    ],
    "Person Form",
  );
}

const emptySchemaResolver: SchemaTreeResolver = {
  getSchemaTree: () => undefined,
};
const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

function TreePageInner(): Rendered {
  const { rc, rendered } = useControls();
  const controlContext = useControlContext();
  const stateRef = useRef<{
    rootControl: Control<any>;
    definitionsControl: Control<ControlDefinition[]>;
    formRoot: ReturnType<typeof createReactiveFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);

  if (!stateRef.current) {
    const rootControl = controlContext.newControl({
      type: "personal",
      firstName: "",
      lastName: "Smith",
      email: "",
      age: 30,
      address: { street: "123 Main St", city: "", zip: "10001" },
      company: "",
      taxId: "",
    });
    const definitionsControl = controlContext.newControl<ControlDefinition[]>([
      personFormDef(),
    ]);
    const schemaTree = createStaticSchemaTree(
      personSchema(),
      emptySchemaResolver,
    );
    const formTree = createReactiveFormTree(
      definitionsControl,
      emptyFormResolver,
    );
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    stateRef.current = {
      rootControl,
      definitionsControl,
      formRoot: formTree.rootNode,
      dataRoot,
    };
  }

  const { rootControl, definitionsControl, formRoot, dataRoot } =
    stateRef.current;

  const formNode = useFormStateNode(controlContext, formRoot, dataRoot);

  return rendered(
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
          Control Tree Visualizer
        </h1>

        <DefinitionEditor definitionsControl={definitionsControl} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: form editor driven by FormStateNode */}
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Form (driven by FormStateNode)
              </h2>
              <div className="flex gap-2">
                <SetTouchedButton node={formNode} />
                <ValidateButton node={formNode} rootControl={rootControl} />
              </div>
            </div>
            <Form node={formNode} />
          </div>

          {/* Middle: FormStateNode tree inspector */}
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-4 shadow">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              FormStateNode Tree
            </h2>
            <FormStateNodeRenderer node={formNode} defaultExpanded={true} />
            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="text-xs font-semibold text-zinc-500 mb-2">
                Legend
              </h3>
              <div className="flex flex-wrap gap-3 text-[10px]">
                <span>{"\u{1F441}\u2713"} visible</span>
                <span>{"\u{1F441}?"} null (script pending)</span>
                <span>{"\u{1F441}\u2717"} hidden</span>
                <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Data
                </Badge>
                <Badge color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  Group
                </Badge>
              </div>
            </div>
          </div>

          {/* Right: raw control tree */}
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-4 shadow">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Raw Control Tree
            </h2>
            <ControlNodeRenderer
              control={rootControl}
              name="root"
              defaultExpanded={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Set touched button ──────────────────────────────────────────────

function SetTouchedButton({ node }: { node: FormStateNode }) {
  return (
    <button
      type="button"
      onClick={() => node.setTouched(true)}
      className="text-xs px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
    >
      Set Touched
    </button>
  );
}

// ── Validate button ─────────────────────────────────────────────────

function ValidateButton({
    node,
    rootControl,
  }: {
    node: FormStateNode;
    rootControl: Control<any>;
  }): Rendered {
  const { rc, rendered } = useControls();
  const valid = rc.isValid(rootControl);
  const [validated, setValidated] = useState(false);

  return rendered(
    <div className="flex items-center gap-2">
      {validated && (
        <span
          className={`text-xs font-mono ${
            valid
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {valid ? "valid ✓" : "invalid ✗"}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          node.validate();
          setValidated(true);
        }}
        className="text-xs px-3 py-1 rounded bg-blue-600 text-white"
      >
        Validate
      </button>
    </div>
  );
}

// ── Definition editor ───────────────────────────────────────────────

function DefinitionEditor({ definitionsControl }: { definitionsControl: Control<ControlDefinition[]> }): Rendered {
  const { rc, rendered } = useControls();
  const { update } = useControlContext();
  const current = rc.getValue(definitionsControl);
  const canonical = JSON.stringify(current, null, 2);

  const [draft, setDraft] = useState(canonical);
  const [error, setError] = useState<string | null>(null);
  const [lastAppliedSerialized, setLastAppliedSerialized] = useState(canonical);

  // If an outside change happens (e.g. an apply from this editor), sync the
  // textarea only when the user hasn't started editing a divergent draft.
  if (canonical !== lastAppliedSerialized && draft === lastAppliedSerialized) {
    setDraft(canonical);
    setLastAppliedSerialized(canonical);
    setError(null);
  }

  const dirty = draft !== canonical;

  const apply = () => {
    try {
      const parsed = JSON.parse(draft);
      if (!Array.isArray(parsed)) {
        setError("Root must be an array of ControlDefinitions");
        return;
      }
      update((wc) =>
        wc.setValue(definitionsControl, parsed as ControlDefinition[]),
      );
      setError(null);
      setLastAppliedSerialized(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setDraft(canonical);
    setError(null);
  };

  return rendered(
    <div className="rounded-lg bg-white dark:bg-zinc-900 p-4 shadow mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Definition JSON (edit and click Apply — reactivity test)
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty}
            className="text-xs px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!dirty}
            className="text-xs px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className={`w-full h-64 font-mono text-xs p-2 rounded border bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 resize-y ${
          error
            ? "border-red-400 dark:border-red-600"
            : dirty
              ? "border-amber-400 dark:border-amber-600"
              : "border-zinc-300 dark:border-zinc-700"
        }`}
      />
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-mono">
          {error}
        </p>
      )}
      {!error && dirty && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Unapplied edits
        </p>
      )}
    </div>
  );
}

export default function TreePage() {
  const controlContext = useMemo(() => createControlContext(), []);

  return (
    <ControlContextProvider value={controlContext}>
      <TreePageInner />
    </ControlContextProvider>
  );
}
