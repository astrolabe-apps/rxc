import {
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  collectionRenderer,
  getExternalEdit,
  getProp,
  StandardActionIds,
  useAction,
  useFieldShell,
  type CollectionProps,
  type CollectionRenderProps,
  type FormProp,
} from "../framework/index.js";

export interface PetCardsExtra {
  /** A renderer-specific *callback* — the shape §6's `Resolved<P>` cannot pass. */
  onCardClick?: (index: number) => void;
  /** A renderer-specific *value*, for contrast. */
  columns?: FormProp<number>;
}

/**
 * A third-party **collection** renderer — the boundary kind §1 had only tested
 * for a field. Imports no UI library. Draws each element as a card with its
 * own Edit / Remove, and an Add below, all composed from the implementation's
 * `action` chrome, and reaches the staged-edit controller for Edit.
 *
 * The per-row chrome is the point: a DataGrid's remove column is this shape.
 */
function PetCardsImpl<T>(
  p: CollectionRenderProps<T> & PetCardsExtra,
): Rendered {
  const Shell = useFieldShell();
  const ctx = useControlContext();
  const edit = getExternalEdit(ctx, p.field);
  const AddBtn = useAction(StandardActionIds.add);
  const EditBtn = useAction(StandardActionIds.edit);
  const RemoveBtn = useAction(StandardActionIds.remove);
  // No controller for a collection, so the implementation opens its own
  // tracking window — a field implementation gets this from `useTextInput`.
  const { rc, rendered } = useReactive();
  const columns = getProp(rc, p.columns);
  const state = p.field.state(rc);
  const locked = state.readOnly || state.disabled;
  return rendered(
    <Shell
      id={p.id}
      label={p.label}
      labelAs="legend"
      surface="custom"
      required={p.required}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
    >
      <div
        className="ff-cards"
        style={{ gridTemplateColumns: `repeat(${columns ?? 2}, 1fr)` }}
      >
        {p.elements.length === 0 && p.empty}
        {p.elements.map((e) => (
          <div
            key={e.key}
            className="ff-card"
            onClick={() => p.onCardClick?.(e.index)}
          >
            <div className="ff-card-body">{e.node}</div>
            {!locked && (
              <div className="ff-card-actions">
                <EditBtn
                  actionId={StandardActionIds.edit}
                  text="Edit"
                  style="secondary"
                  disabled={false}
                  busy={false}
                  onClick={() => edit.beginEdit(e.index, e.field)}
                />
                <RemoveBtn
                  actionId={StandardActionIds.remove}
                  text="Remove"
                  style="link"
                  disabled={!p.actions.canRemove}
                  busy={false}
                  onClick={() => p.actions.remove(e.index)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {!locked && (
        <AddBtn
          actionId={StandardActionIds.add}
          text="Add card"
          style="primary"
          disabled={!p.actions.canAdd}
          busy={false}
          onClick={() => p.actions.add({ name: "" })}
        />
      )}
    </Shell>,
  );
}

export const PetCards = collectionRenderer<{ name: string }, PetCardsExtra>(
  PetCardsImpl,
) as unknown as <T extends { name: string }>(
  props: CollectionProps<T> & PetCardsExtra,
) => Rendered;
