import {
  type ChangeListenerFunc,
  type Control,
  noopReadContext,
  type ReadContext,
} from "@rxc/controls-core";
import {
  ControlDefinitionType,
  type DataControlDefinition,
  DataRenderType,
  type FieldOption,
  type GroupedControlsDefinition,
  GroupRenderType,
  isDataControl,
} from "../json";
import type {
  ChildNodeSpec,
  DataCursor,
  FormCursor,
  FormNode,
  FormStateNode,
} from "../types";
import type { SchemaInterface } from "../schemaInterface";

/**
 * Default child resolver for a {@link FormStateNode}. Layer-2 surface:
 *
 * - **Data control rendered as `CheckList` / `Radio`**: expand into one child
 *   per available {@link FieldOption} (from `resolved.fieldOptions`). Each
 *   option child reuses the form node's declared children (if any) wrapped
 *   in a `Contents` group so the renderer can compose per-option UI.
 * - **Data control bound to a collection field** (and representing the array
 *   itself, not a specific element): expand into one child per array element.
 * - **Everything else**: children come from the form definition's own
 *   `children`, inheriting this node's resolved `DataNode` as their parent
 *   data context.
 */
export function defaultResolveChildren(
  node: FormStateNode,
  rc: ReadContext,
): ChildNodeSpec[] {
  const { form } = node;
  if (!form) return [];

  const state = node.getState(rc);
  const def = state.resolved.definition;
  const formChildren = form.cursor(rc).children;
  const dataNode = state.dataNode;
  const parentData = dataNode ?? node.parent;
  const schemaInterface = node.schemaInterface;

  if (isDataControl(def) && dataNode) {
    const renderType = def.renderOptions?.type;
    if (
      renderType === DataRenderType.CheckList ||
      renderType === DataRenderType.Radio
    ) {
      const options = state.resolved.fieldOptions;
      if (options && options.length > 0 && formChildren.length > 0) {
        return resolveOptionChildren(
          options,
          dataNode,
          parentData,
          form,
          schemaInterface,
        );
      }
      return [];
    }

    const field = state.field;
    if (field?.collection) {
      const dataCursor = dataNode.cursor(rc);
      // Only expand when this node represents the array itself, not an
      // individual element.
      if (dataCursor.elementIndex === undefined) {
        return resolveArrayChildren(dataCursor, form, formChildren, rc);
      }
    }
  }

  // Default: one child per form definition child, with the current dataNode
  // (or the starting parent) as the child's parent data context. Omitting
  // `definition` lets the child source its own-def reactively from
  // `childCursor.node` — so definition edits (for reactive form trees)
  // propagate through the child FormStateNode.
  return formChildren.map((childCursor) => ({
    childKey: childCursor.node.id,
    create: () => ({
      node: childCursor.node,
      parent: parentData,
    }),
  }));
}

/**
 * Expand a CheckList/Radio data control into one child per option.
 *
 * Each child wraps the form's declared children in a `Contents` group and
 * binds the parent DataNode as the data context. The per-option metadata
 * (`option` and `optionSelected`) is exposed via the child's `variables`
 * hook — the callback receives a `ChangeListenerFunc` so renderers
 * subscribing to the variable get notified when the underlying data
 * control's value changes.
 */
function resolveOptionChildren(
  options: FieldOption[],
  dataNode: import("../types").DataNode,
  parentData: import("../types").DataNode,
  form: FormNode,
  schemaInterface: SchemaInterface,
): ChildNodeSpec[] {
  return options.map((option) => ({
    childKey: String(option.value),
    create: (_scope, meta) => {
      meta["fieldOptionValue"] = option.value;
      return {
        definition: {
          type: ControlDefinitionType.Group,
          groupOptions: { type: GroupRenderType.Contents },
        } as GroupedControlsDefinition,
        parent: parentData,
        node: form,
        variables: (changes) => ({
          formData: {
            option,
            optionSelected: isOptionSelected(
              schemaInterface,
              option,
              dataNode,
              changes,
            ),
          },
        }),
      };
    },
  }));
}

/**
 * Whether a given option is currently selected for this data node.
 *
 * For collection fields (CheckList) the option's value must appear in the
 * array. For scalar fields (Radio) the current value must equal the option
 * value under {@link SchemaInterface.compareValue}.
 *
 * Registers a Value subscription on the underlying control through `changes`
 * so callers running inside a reactive scope re-evaluate when the selection
 * changes.
 */
function isOptionSelected(
  schemaInterface: SchemaInterface,
  option: FieldOption,
  dataNode: import("../types").DataNode,
  _changes: ChangeListenerFunc<any>,
): boolean {
  // Layer-2 simplification: we read the data value as a snapshot. A proper
  // `trackedValue`-equivalent (that routes subscriptions through `_changes`)
  // will come with the renderer package; until then renderers that need
  // live re-evaluation of `optionSelected` should subscribe to the data
  // control directly.
  const cursor = dataNode.cursor(noopReadContext);
  const field = cursor.field;
  const value = cursor.control.valueNow;
  if (field.collection) {
    return Array.isArray(value) && value.includes(option.value);
  }
  return schemaInterface.compareValue(field, value, option.value) === 0;
}

/**
 * Expand an array data cursor into one child spec per element. Uses
 * {@link DataCursor.childElement | childElement(i)} to obtain a stable
 * element `DataNode` handle for each child.
 *
 * If the form has exactly one child, that child's definition is reused for
 * every element. With no children, a default data control targeting `"."`
 * (the element itself) is synthesized.
 */
function resolveArrayChildren(
  arrayCursor: DataCursor,
  form: FormNode,
  formChildren: FormCursor[],
  rc: ReadContext,
): ChildNodeSpec[] {
  const arrayControl = arrayCursor.control as Control<unknown[]>;
  const elements = rc.getElements(arrayControl);
  const singleChild = formChildren.length === 1 ? formChildren[0] : null;

  const specs: ChildNodeSpec[] = [];
  for (let i = 0; i < elements.length; i++) {
    const elementCursor = arrayCursor.childElement(i);
    if (!elementCursor) continue;
    const elementDataNode = elementCursor.node;
    const elemControl = elements[i];
    specs.push({
      childKey: `${elemControl.uniqueId}/${i}`,
      create: () =>
        singleChild
          ? // Reactive — child sources its own-def from singleChild.node.
            {
              node: singleChild.node,
              parent: elementDataNode,
            }
          : // No single-child template — synthesize a static default def.
            {
              node: form,
              parent: elementDataNode,
              definition: {
                type: ControlDefinitionType.Data,
                field: ".",
                hideTitle: true,
                renderOptions: { type: DataRenderType.Standard },
              } as DataControlDefinition,
            },
    });
  }
  return specs;
}

