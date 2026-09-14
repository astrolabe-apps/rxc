"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import {
  isDataControl,
  ValidatorType,
  type LengthValidator,
} from "@rx-controls/forms-core";
import {
  rendererClass,
  type DataRendererProps,
} from "@rx-controls/forms-react-core";
import { Field } from "@rx-controls/forms";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DEFAULT_WRAPPER = "flex flex-col gap-3";
const DEFAULT_CHILD =
  "flex items-start gap-2 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3";
const DEFAULT_HANDLE =
  "cursor-grab select-none px-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200";
const DEFAULT_REMOVE =
  "text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 disabled:opacity-40";
const DEFAULT_ADD =
  "self-start text-xs px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40";

interface ArrayLengthRange {
  min: number;
  max: number;
}

function getLengthRange(
  validators: { type: string }[] | null | undefined,
): ArrayLengthRange {
  let min = 0;
  let max = Infinity;
  if (!validators) return { min, max };
  for (const v of validators) {
    if (v.type === ValidatorType.Length) {
      const lv = v as LengthValidator;
      if (lv.min != null) min = lv.min;
      if (lv.max != null) max = lv.max;
    }
  }
  return { min, max };
}

/**
 * Reorderable array renderer. Same shape as `ArrayRenderer` from
 * `@rx-controls/forms` but each row exposes a drag handle and
 * `@dnd-kit/sortable` reorders the underlying array control via
 * `wc.updateElements`.
 *
 * Default registration is keyed off `renderType: "SortableArray"` so
 * apps opt in per definition; consumers can also slot it ahead of the
 * default `ArrayRenderer` to make every collection sortable.
 */
export function SortableArrayRenderer({ node }: DataRendererProps): Rendered {
  const { rc, rendered, update } = useReactive();
  // Above the bail-out below — `useSensors`/`useSensor` are hooks.
  const sensors = useSensors(useSensor(PointerSensor));

  const { data, definition } = node.getState(rc);
  if (!data) return rendered(null);

  const children = node.getChildren(rc);
  const validators = isDataControl(definition)
    ? definition.validators
    : undefined;
  const { min, max } = getLengthRange(validators);
  const len = children.length;

  const wrapperClass = rendererClass(definition.styleClass, DEFAULT_WRAPPER);

  const ids = children.map((c) => c.uniqueId);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    update((wc) =>
      wc.updateElements(
        data as Parameters<typeof wc.updateElements>[0],
        (elems) => arrayMove(elems, oldIndex, newIndex),
      ),
    );
  };

  return rendered(
    <div className={wrapperClass}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {children.map((child, i) => (
            <SortableRow
              key={child.uniqueId}
              id={child.uniqueId}
              onRemove={() =>
                update((wc) =>
                  wc.removeElement(
                    data as Parameters<typeof wc.removeElement>[0],
                    i,
                  ),
                )
              }
              canRemove={len > min}
            >
              <Field node={child} />
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        disabled={len >= max}
        onClick={() =>
          update((wc) =>
            wc.addElement(data as Parameters<typeof wc.addElement>[0], null),
          )
        }
        className={DEFAULT_ADD}
      >
        Add
      </button>
    </div>
  );
}

function SortableRow({
  id,
  children,
  onRemove,
  canRemove,
}: {
  id: string;
  children: React.ReactNode;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={DEFAULT_CHILD}>
      <button
        type="button"
        aria-label="Drag to reorder"
        className={DEFAULT_HANDLE}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="flex-1">{children}</div>
      <button
        type="button"
        disabled={!canRemove}
        onClick={onRemove}
        className={DEFAULT_REMOVE}
      >
        Remove
      </button>
    </div>
  );
}
