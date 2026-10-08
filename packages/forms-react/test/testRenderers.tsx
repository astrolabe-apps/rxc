import { useEffect, useRef } from "react";
import { useFormEdit, useReactive, type Rendered } from "@rx-controls/react";
import {
  getProp,
  mergeClass,
  type ActionRenderProps,
  type CollectionRenderProps,
  type DialogRenderProps,
  type DisclosureRenderProps,
  type TabsRenderProps,
  type WizardRenderProps,
  type DisplayRenderProps,
  type FormRenderers,
  type GroupRenderProps,
  type TextDisplayRenderProps,
  type TextFieldRenderProps,
  type RichTextRenderProps,
  drawRichText,
} from "../src/index";

/**
 * A minimal implementation for the boundary tests: plain DOM, every slot
 * filled, and just enough markup to observe what the boundary handed over.
 * `mounts` counts each widget's mounts, so a test can tell a remount from a
 * re-render.
 */
export const mounts = new Map<string, number>();

function useMountCount(id: string) {
  useEffect(() => {
    mounts.set(id, (mounts.get(id) ?? 0) + 1);
  }, [id]);
}

const cls = (c: unknown) => mergeClass(undefined, c as never);

function TextField(p: TextFieldRenderProps): Rendered {
  const { rc, rendered, update } = useReactive();
  useMountCount(p.id);
  const edit = useFormEdit();
  const placeholder = getProp(rc, p.placeholder);
  return rendered(
    <label data-field={p.id} data-inline={p.inline ? "" : undefined} data-help-placement={p.helpPlacement}>
      <span data-label data-hidden-label={p.hideLabel ? "" : undefined}>{p.label}</span>
      {p.required && <span data-required>*</span>}
      <input
        id={p.id}
        className={cls(p.className)}
        placeholder={placeholder}
        value={rc.getValue(p.field) ?? ""}
        disabled={!!edit.disabled}
        readOnly={!!edit.readOnly}
        onChange={(e) => update((wc) => wc.setValue(p.field, e.target.value))}
        onBlur={() => update((wc) => wc.setTouched(p.field, true))}
      />
      {p.error && <span data-error>{p.error}</span>}
    </label>,
  );
}

function Rich({ nodes }: RichTextRenderProps) {
  return (
    <span data-rich>
      {drawRichText(nodes, {
        strong: (c, k) => <b key={k}>{c}</b>,
        em: (c, k) => <i key={k}>{c}</i>,
        sup: (c, k) => <sup key={k}>{c}</sup>,
        sub: (c, k) => <sub key={k}>{c}</sub>,
        link: (n, c, k) => (
          <a key={k} href={n.href} target={n.target}>
            {c}
          </a>
        ),
        break: (k) => <br key={k} />,
        image: (n, k) => <img key={k} src={n.src} alt={n.alt} width={n.width} />,
      })}
    </span>
  );
}

function Contents(p: GroupRenderProps) {
  return (
    <div
      data-group
      data-variant={p.variant}
      data-invalid={p.invalid ? "" : undefined}
      data-layout={p.layout ? JSON.stringify(p.layout) : undefined}
      className={cls(p.className)}
      hidden={p.hidden || undefined}
    >
      {p.title !== undefined && (
        <b data-title data-level={p.headingLevel}>
          {p.title}
        </b>
      )}
      {p.children}
    </div>
  );
}

function Elements(p: CollectionRenderProps<unknown>) {
  return (
    <ul data-elements data-error={p.error ? String(p.error) : undefined}>
      {p.elements.length === 0 && p.empty}
      {p.elements.map((e) => (
        <li key={e.key} data-row={e.index}>
          {e.node}
        </li>
      ))}
    </ul>
  );
}

function Action(p: ActionRenderProps) {
  return (
    <button
      type="button"
      data-action={p.actionId}
      data-busy={p.busy ? "" : undefined}
      data-variant={p.variant}
      data-submit={p.submit ? "" : undefined}
      disabled={p.disabled}
      onClick={p.onClick}
    >
      {p.children ?? p.text}
    </button>
  );
}

function Text(p: TextDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  return rendered(
    <span
      data-text
      data-tone={p.tone}
      data-announce={p.announce ? "" : undefined}
      aria-label={p.accessibleName}
      data-inline={p.inline ? "" : undefined}
    >
      {getProp(rc, p.text)}
      {p.children}
    </span>,
  );
}

function Plain(p: DisplayRenderProps) {
  return <span>{p.children}</span>;
}

function Visibility(p: { visible: boolean; children: React.ReactNode }) {
  return p.visible ? <>{p.children}</> : null;
}

/** Every panel rendered, inactive ones hidden — the contract's rule. */
function Tabs(p: TabsRenderProps) {
  return (
    <div data-tabs hidden={p.hidden || undefined}>
      {p.items.filter((i) => !i.hidden).map((i) => (
        <button
          key={"t" + i.key}
          type="button"
          data-tab={i.key}
          data-active={i.active ? "" : undefined}
          data-invalid={i.invalid ? "" : undefined}
          onClick={() => p.setActive(i.key)}
        >
          {i.title}
        </button>
      ))}
      {p.items.map((i) => (
        <section key={"p" + i.key} data-panel={i.key} hidden={!i.active || undefined}>
          {i.content}
        </section>
      ))}
    </div>
  );
}

function Wizard(p: WizardRenderProps) {
  return (
    <div data-wizard data-index={p.index} data-navigation={p.navigation}>
      {p.items.map((i) => (
        <section
          key={i.key}
          data-page={i.key}
          data-step-hidden={i.hidden ? "" : undefined}
          data-invalid={i.invalid ? "" : undefined}
          hidden={!i.active || undefined}
        >
          {i.content}
        </section>
      ))}
      <button type="button" data-back disabled={!p.canBack} onClick={p.back} />
      <button type="button" data-next disabled={!p.canNext} onClick={() => void p.next()} />
    </div>
  );
}

/** Content always mounted, in one parent; closed hides it. */
function Dialog(p: DialogRenderProps) {
  return (
    <div
      data-dialog
      data-open={p.open ? "" : undefined}
      data-inline={p.inline ? "" : undefined}
      data-invalid={p.invalid ? "" : undefined}
      hidden={(!p.open && !p.inline) || undefined}
    >
      {p.title !== undefined && <b>{p.title}</b>}
      {p.content}
    </div>
  );
}

/** Content always mounted; closed hides it. */
function Disclosure(p: DisclosureRenderProps) {
  return (
    <div data-disclosure data-open={p.open ? "" : undefined} data-invalid={p.invalid ? "" : undefined}>
      <button type="button" data-toggle aria-expanded={p.open} aria-controls={p.id} onClick={() => p.setOpen(!p.open)}>
        {p.title}
      </button>
      <div id={p.id} hidden={!p.open || undefined}>
        {p.content}
      </div>
    </div>
  );
}

const Nothing = () => null;

export const testRenderers: FormRenderers = {
  name: "test",
  textfield: TextField,
  checkbox: Nothing,
  select: Nothing,
  radio: Nothing,
  displayOnly: Nothing,
  action: Action,
  text: Text,
  html: Plain,
  icon: Plain,
  richText: Rich,
  image: Plain,
  contents: Contents,
  inline: Contents,
  tabs: Tabs,
  wizard: Wizard,
  dialog: Dialog,
  disclosure: Disclosure,
  elements: Elements,
  fieldShell: ({ children }) => <>{children}</>,
  inputFrame: Nothing,
  visibility: Visibility,
  checkList: Nothing,
  form: ({ onSubmit, children }) => (
    <form
      data-form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  ),
};

/** Renders how many times it rendered, into `renders`. */
export function useRenderCount(key: string, renders: Map<string, number>) {
  const n = useRef(0);
  n.current++;
  renders.set(key, n.current);
}
