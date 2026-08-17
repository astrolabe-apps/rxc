"use client";

/**
 * The legacy hook surface — thin adapters over `@rxc/controls`.
 *
 * Two systematic translations:
 * - legacy no-arg closures (`useComputed(() => …)`) become rc-taking
 *   closures via `withAmbient(rc, fn)`, so ambient getter reads register as
 *   rc dependencies;
 * - types cross the boundary through `asLegacy`/`asCore` (same objects at
 *   runtime — the prototype patch carries both surfaces).
 *
 * Context resolution inside the delegated rxc hooks is provider-if-present,
 * else the compat singleton (see `reactContext.ts`).
 */

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Control as CoreControl } from "@rxc/controls-core";
import {
  ensureSelectableValues as rxcEnsureSelectableValues,
  useAsyncValidator as rxcUseAsyncValidator,
  useComputed as rxcUseComputed,
  useControl as rxcUseControl,
  useControlEffect as rxcUseControlEffect,
  useControlGroup as rxcUseControlGroup,
  usePreviousValue as rxcUsePreviousValue,
  useSelectableArray as rxcUseSelectableArray,
  useValidator as rxcUseValidator,
  type SelectionGroupSync as RxcSelectionGroupSync,
} from "@rxc/controls";
import { withAmbient } from "./ambient.js";
import { convertSetup } from "./newControl.js";
import { asCore, asLegacy } from "./patch.js";
import type { Control, ControlSetup, ControlValue } from "./types.js";

// ── useRefState / useDebounced (pure React utilities, legacy-verbatim) ─

export function useRefState<A>(init: () => A): [MutableRefObject<A>, boolean] {
  const ref = useRef<A | null>(null);
  const isInitial = ref.current === null;
  if (isInitial) {
    ref.current = init();
  }
  return [ref as MutableRefObject<A>, isInitial];
}

/** Debounce a callback; pending runs are dropped when superseded, and an
 * in-flight AbortController result is aborted (legacy behavior). */
export function useDebounced<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const ref = useRef<
    [T, ReturnType<typeof setTimeout> | undefined, unknown]
  >([func, undefined, undefined]);
  ref.current[0] = func;
  return (...args) => {
    const c = ref.current;
    if (c[1]) clearTimeout(c[1]);
    if (c[2] instanceof AbortController) {
      c[2].abort();
      c[2] = undefined;
    }
    c[1] = setTimeout(() => (ref.current[2] = ref.current[0](...args)), delay);
  };
}

// ── useControl ───────────────────────────────────────────────────────

export function useControl<V, M = any>(
  initialState: V | (() => V),
  configure?: ControlSetup<V, M> & { use?: Control<V> },
  afterInit?: (c: Control<V>) => void,
): Control<V>;
export function useControl<V = undefined>(): Control<V | undefined>;
export function useControl<V>(
  initialState?: V | (() => V),
  configure?: ControlSetup<V> & { use?: Control<V> },
  afterInit?: (c: Control<V>) => void,
): Control<V> {
  const { use, ...setup } = configure ?? {};
  const c = rxcUseControl<V>(initialState as V | (() => V), {
    ...convertSetup(setup as ControlSetup<V>),
    use: use ? asCore(use) : undefined,
  });
  const didInit = useRef(false);
  if (!didInit.current) {
    didInit.current = true;
    // Legacy calls afterInit only for controls this hook created.
    if (!use) afterInit?.(asLegacy(c));
  }
  return asLegacy(c);
}

// ── Computed / effects ───────────────────────────────────────────────

export function useComputed<V>(compute: () => V): Control<V> {
  return asLegacy(rxcUseComputed((rc) => withAmbient(rc, compute)));
}

/** @deprecated Exactly the same as useComputed (legacy alias). */
export function useCalculatedControl<V>(calculate: () => V): Control<V> {
  return useComputed(calculate);
}

/**
 * Run a side effect when a computed value changes. `compute` reads controls
 * ambiently; `initial` matches legacy (function = called with the first
 * value, `true` = `onChange` runs first time).
 */
export function useControlEffect<V>(
  compute: () => V,
  onChange: (value: V) => void,
  initial?: ((value: V) => void) | boolean,
): void {
  rxcUseControlEffect((rc) => withAmbient(rc, compute), onChange, initial);
}

export function useValueChangeEffect<V>(
  control: Control<V>,
  changeEffect: (value: V) => void,
  debounce?: number,
  runInitial?: boolean,
): void {
  const state = useRef<{
    effect: (value: V) => void;
    timer: ReturnType<typeof setTimeout> | undefined;
  }>({ effect: changeEffect, timer: undefined });
  state.current.effect = changeEffect;
  const debounceRef = useRef(debounce);

  rxcUseControlEffect(
    (rc) => rc.getValue(asCore(control)),
    (v) => {
      const d = debounceRef.current;
      if (typeof d === "number") {
        const s = state.current;
        if (s.timer) clearTimeout(s.timer);
        s.timer = setTimeout(() => state.current.effect(v), d);
      } else {
        state.current.effect(v);
      }
    },
    runInitial ? true : undefined,
  );

  useEffect(
    () => () => {
      if (state.current.timer) clearTimeout(state.current.timer);
    },
    [],
  );
}

// ── Validators ───────────────────────────────────────────────────────

export function useValidator<V>(
  control: Control<V>,
  validator: (value: V) => string | null | undefined,
  key: string = "default",
): void {
  rxcUseValidator(
    asCore(control),
    (v, rc) => withAmbient(rc, () => validator(v)),
    key,
  );
}

export function useAsyncValidator<V>(
  control: Control<V>,
  validator: (
    control: Control<V>,
    abortSignal: AbortSignal,
  ) => Promise<string | null | undefined>,
  delay: number,
  validCheckValue?: (control: Control<V>) => any,
): void {
  rxcUseAsyncValidator(
    asCore(control),
    (c, signal) => validator(asLegacy(c), signal),
    delay,
    validCheckValue
      ? (rc, c) => withAmbient(rc, () => validCheckValue(asLegacy(c)))
      : undefined,
  );
}

// ── Groups / previous / selectable ───────────────────────────────────

export function useControlGroup<C extends { [k: string]: Control<any> }>(
  fields: C,
  deps?: unknown[],
): Control<{ [K in keyof C]: ControlValue<C[K]> }> {
  const group = rxcUseControlGroup(
    fields as unknown as Record<string, CoreControl<any>>,
    deps,
  );
  return asLegacy(group) as Control<{ [K in keyof C]: ControlValue<C[K]> }>;
}

export function usePreviousValue<V>(
  control: Control<V>,
): Control<{ previous?: V; current: V }> {
  return asLegacy(rxcUsePreviousValue(asCore(control)));
}

export interface SelectionGroup<V> {
  selected: boolean;
  value: V;
}

/** Legacy syncers take only `original`; the engine passes a second `ctx`
 * argument that legacy-written syncers simply ignore. */
export type SelectionGroupSync<V> = (
  original: Control<V[]>,
  ...rest: any[]
) => [boolean, Control<V>, boolean?][];

export function ensureSelectableValues<V>(
  values: V[],
  key: (v: V) => any,
): SelectionGroupSync<V> {
  return rxcEnsureSelectableValues(values, key) as unknown as SelectionGroupSync<V>;
}

export function useSelectableArray<V>(
  control: Control<V[]>,
  groupSyncer?: SelectionGroupSync<V>,
  setup?: ControlSetup<SelectionGroup<V>[]>,
  reset?: any,
): Control<SelectionGroup<V>[]> {
  return asLegacy(
    rxcUseSelectableArray(
      asCore(control),
      groupSyncer as unknown as RxcSelectionGroupSync<V> | undefined,
      convertSetup(setup),
      reset,
    ),
  ) as Control<SelectionGroup<V>[]>;
}

// ── controlValues ────────────────────────────────────────────────────

export function controlValues<A, B>(
  a: Control<A>,
  b: Control<B>,
): () => [A, B];
export function controlValues<A, B, C>(
  a: Control<A>,
  b: Control<B>,
  c: Control<C>,
): () => [A, B, C];
export function controlValues<A, B, C, D>(
  a: Control<A>,
  b: Control<B>,
  c: Control<C>,
  d: Control<D>,
): () => [A, B, C, D];
export function controlValues<A, B, C, D, E>(
  a: Control<A>,
  b: Control<B>,
  c: Control<C>,
  d: Control<D>,
  e: Control<E>,
): () => [A, B, C, D, E];
export function controlValues<A extends Record<string, Control<any>>>(
  controls: A,
): () => { [K in keyof A]: ControlValue<A[K]> };
export function controlValues(...args: any[]): () => any {
  return () => {
    // Legacy contract: a single argument is always the record form.
    if (args.length === 1) {
      return Object.fromEntries(
        Object.entries(args[0] as Record<string, Control<any>>).map(
          ([k, c]) => [k, c.value],
        ),
      );
    }
    return args.map((c: Control<any>) => c.value);
  };
}
