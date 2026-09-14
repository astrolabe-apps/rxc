"use client";

import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import type { FormStateNode } from "@rx-controls/forms-core";
import { useFormOptions } from "@rx-controls/forms-react-core";
import type { HtmlFormOptions } from "./theme";
import { useHtmlTheme } from "./useHtmlTheme";

export interface ErrorProps {
  node: FormStateNode;
  id: string;
  /**
   * When true, render every error message attached to the bound data
   * control as a `<ul>` of `<li>`. When false, render only the first
   * error as a `<span>`. Defaults to the `showAllErrors` option on
   * `HtmlFormOptions`, which itself defaults to false.
   */
  all?: boolean;
}

export type ErrorComponent = ComponentType<ErrorProps>;

export function DefaultError({ node, id, all }: ErrorProps): Rendered {
  const { rc, rendered } = useReactive();
  const { data, touched } = node.getState(rc);
  const theme = useHtmlTheme().error;
  const opts = useFormOptions() as HtmlFormOptions;
  const showAll = all ?? !!opts.showAllErrors;
  if (!data || !touched) return rendered(null);

  if (showAll) {
    const errors = rc.getErrors(data);
    const entries = Object.entries(errors);
    if (entries.length === 0) return rendered(null);
    return rendered(
      <ul
        role="alert"
        id={id}
        className={theme.className}
      >
        {entries.map(([key, message]) => (
          <li key={key} className={theme.itemClass}>
            {message}
          </li>
        ))}
      </ul>
    );
  }

  const message = rc.getError(data);
  if (!message) return rendered(null);
  return rendered(
    <span
      role="alert"
      id={id}
      className={theme.className}
    >
      {message}
    </span>
  );
}

const ErrorCtx = createContext<ErrorComponent>(DefaultError);

export function ErrorProvider({
  value,
  children,
}: {
  value: ErrorComponent;
  children: ReactNode;
}) {
  return <ErrorCtx.Provider value={value}>{children}</ErrorCtx.Provider>;
}

export function useError(): ErrorComponent {
  return useContext(ErrorCtx);
}
