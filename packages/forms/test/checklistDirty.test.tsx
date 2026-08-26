// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { ControlContextProvider, createControlContext } from "@rxc/controls";
import { noopReadContext, type Control } from "@rxc/controls-core";
import {
  ControlDefinitionType,
  DataRenderType,
  FieldType,
  createDataNode,
  createFormStateNode,
  createFormTreeResolver,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  defaultResolveChildren,
  type ControlDefinition,
  type FormGlobalOptions,
  type SchemaField,
} from "@rxc/forms-core";
import { Form } from "@rxc/forms";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const rd = noopReadContext;

const schemaFields: SchemaField[] = [
  {
    type: FieldType.String,
    field: "tags",
    collection: true,
    options: [
      { name: "Alpha", value: "a" },
      { name: "Beta", value: "b" },
      { name: "Gamma", value: "c" },
    ],
  } as SchemaField,
];

const formDef: ControlDefinition = {
  type: ControlDefinitionType.Data,
  field: "tags",
  renderOptions: { type: DataRenderType.CheckList },
} as ControlDefinition;

/** Mount the real ChecklistRenderer over `{ tags }` and hand back the DOM
 *  checkboxes plus the bound data control. */
function mountChecklist(initialTags: string[] | null) {
  const ctx = createControlContext();
  const schemaTree = createStaticSchemaTree(
    schemaFields,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    [formDef],
    createFormTreeResolver(() => undefined),
  );
  const dataControl = ctx.newControl<{ tags: string[] | null }>({
    tags: initialTags,
  });
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren: defaultResolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
  const fieldNode = root.getChildren(rd)[0];

  const container = document.createElement("div");
  document.body.appendChild(container);
  const reactRoot = createRoot(container);
  act(() => {
    reactRoot.render(
      <ControlContextProvider value={ctx}>
        <Form node={fieldNode} />
      </ControlContextProvider>,
    );
  });

  const boxes = () =>
    Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
  const click = (i: number) => act(() => boxes()[i].click());

  return {
    ctx,
    form: dataControl,
    tags: dataControl.fields.tags as Control<string[] | null>,
    boxes,
    click,
    cleanup: () => {
      act(() => reactRoot.unmount());
      container.remove();
    },
  };
}

describe("checklist dirty state", () => {
  it("unchecking and rechecking an option leaves the form clean", () => {
    const h = mountChecklist(["a", "b", "c"]);
    try {
      expect(h.boxes().map((b) => b.checked)).toEqual([true, true, true]);
      expect(h.form.dirtyNow).toBe(false);

      h.click(0); // uncheck Alpha
      expect(h.tags.valueNow).toEqual(["b", "c"]);
      expect(h.tags.dirtyNow).toBe(true);
      expect(h.form.dirtyNow).toBe(true);

      h.click(0); // recheck Alpha
      expect(h.boxes().map((b) => b.checked)).toEqual([true, true, true]);
      // Restored to the initial value itself, not ["b", "c", "a"] — so the
      // field and the whole form read clean again.
      expect(h.tags.valueNow).toEqual(["a", "b", "c"]);
      expect(h.tags.dirtyNow).toBe(false);
      expect(h.form.dirtyNow).toBe(false);
    } finally {
      h.cleanup();
    }
  });

  it("a genuinely different selection stays dirty", () => {
    const h = mountChecklist(["a"]);
    try {
      h.click(1); // check Beta
      expect(h.tags.valueNow).toEqual(["a", "b"]);
      expect(h.form.dirtyNow).toBe(true);
    } finally {
      h.cleanup();
    }
  });

  it("round-trips a null initial value without materialising []", () => {
    const h = mountChecklist(null);
    try {
      expect(h.form.dirtyNow).toBe(false);

      h.click(2); // check Gamma
      expect(h.tags.valueNow).toEqual(["c"]);
      expect(h.form.dirtyNow).toBe(true);

      h.click(2); // uncheck Gamma
      expect(h.tags.valueNow).toBe(null);
      expect(h.form.dirtyNow).toBe(false);
    } finally {
      h.cleanup();
    }
  });
});
