import { useMemo, type ReactNode } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  FormScopeProvider,
  getProp,
  narrowScope,
  useBoundScope,
  type FormProp,
  type Presence,
  type ScopeState,
} from "@rx-controls/forms-react";

export interface SelectChildItem {
  key: string;
  children: ReactNode;
}

export interface SelectChildProps {
  items: SelectChildItem[];
  /** Which item shows: a key, or an index — legacy's `childIndexExpression`. */
  selected: FormProp<string | number | undefined | null>;
  hidden?: FormProp<boolean | undefined>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
}

/**
 * Legacy's `SelectChild` group, written as a **third party**: a container
 * whose active branch is chosen by *data* rather than by the user. Not a
 * built-in; it is here to show that a container producing `silent` can be
 * written outside the package with the public scope API alone —
 * `useBoundScope`, `narrowScope`, `FormScopeProvider`.
 *
 * The other branches are `silent`, not absent: every branch stays mounted
 * and keeps validating — a required field in a branch the data has not
 * chosen still reports — and each hides itself with the `hidden` attribute
 * on an unchanging wrapper. Design mode shows every branch, the same
 * "render everything" the built-in containers do.
 *
 * It draws no chrome and has no registry slot: the first container with no
 * implementation surface at all, which is what makes it writable from
 * outside without a boundary factory.
 */
export function SelectChild(props: SelectChildProps): Rendered {
  const { rc, rendered } = useReactive();
  const scope = useBoundScope(props);
  const sel = getProp(rc, props.selected);
  const activeKey = typeof sel === "number" ? props.items[sel]?.key : sel;
  const stacked = scope.designMode;
  return rendered(
    <FormScopeProvider scope={scope}>
      {props.items.map((it) => (
        <Branch
          key={it.key}
          parent={scope}
          on={stacked || it.key === activeKey}
        >
          {it.children}
        </Branch>
      ))}
    </FormScopeProvider>,
  );
}

function Branch({
  parent,
  on,
  children,
}: {
  parent: ScopeState;
  on: boolean;
  children: ReactNode;
}) {
  const presence: Presence = on ? "rendered" : "silent";
  const scope = useMemo(
    () => narrowScope(parent, { presence: () => presence }),
    [parent, presence],
  );
  return (
    <div className="demo-branch" hidden={!on}>
      <FormScopeProvider scope={scope}>{children}</FormScopeProvider>
    </div>
  );
}
