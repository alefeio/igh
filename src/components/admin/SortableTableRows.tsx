"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableRowProps<T> = {
  id: string;
  item: T;
  children: React.ReactNode;
};

function SortableRow<T>({ id, item, children }: SortableRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      <td className="w-8 cursor-grab active:cursor-grabbing border-b border-[var(--card-border)] bg-[var(--igh-surface)] p-1" {...listeners} title="Arrastar para reordenar">
        ⋮⋮
      </td>
      {children}
    </tr>
  );
}

export type SortableTableRowsProps<T extends { id: string }> = {
  items: T[];
  onReorder: (ids: string[]) => Promise<void>;
  children: (item: T) => React.ReactNode;
  emptyMessage?: React.ReactNode;
  /** Use true when inside <table> so DndContext is not rendered (parent must wrap with SortableTableDndWrapper). */
  noDndWrapper?: boolean;
};

function SortableTableRowsInner<T extends { id: string }>({
  items,
  onReorder,
  children,
  emptyMessage = "Nenhum item.",
  noDndWrapper,
}: SortableTableRowsProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    await onReorder(reordered.map((i) => i.id));
  }

  const body = (
    <>
      {items.length === 0 ? (
        <tbody>
          <tr>
            <td colSpan={10} className="border-b border-[var(--card-border)] p-4 text-center text-[var(--text-secondary)]">
              {emptyMessage}
            </td>
          </tr>
        </tbody>
      ) : (
        <tbody>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableRow key={item.id} id={item.id} item={item}>
                {children(item)}
              </SortableRow>
            ))}
          </SortableContext>
        </tbody>
      )}
    </>
  );

  if (noDndWrapper) {
    return body;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {body}
    </DndContext>
  );
}

/** Wrap the whole <Table> with this when using SortableTableRows with noDndWrapper inside a table (avoids invalid <div> inside <table>). */
export function SortableTableDndWrapper<T extends { id: string }>({
  items,
  onReorder,
  children,
}: {
  items: T[];
  onReorder: (ids: string[]) => Promise<void>;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    await onReorder(reordered.map((i) => i.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

export function SortableTableRows<T extends { id: string }>(props: SortableTableRowsProps<T>) {
  return <SortableTableRowsInner {...props} />;
}
