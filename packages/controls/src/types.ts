/**
 * @astroapps/controls-react — type spec
 *
 * This file defines the public API for the clean React adapter package.
 * See also: types.ts for the @astroapps/controls core spec.
 */

import type { ReactNode } from "react";
import type { Control, ReadContext, WriteContext, ControlContext } from "@rxc/controls-core";

export type UpdateFn = (cb: (wc: WriteContext) => void) => void;
export type UseComputed = <V>(compute: (rc: ReadContext) => V) => Control<V>;

export interface ControlsContext {
  rc: ReadContext;
  update: UpdateFn;
  controlContext: ControlContext;
  useComputed: UseComputed;
}

export type ControlsRender<P> = (
  props: P,
  ctx: ControlsContext,
) => ReactNode;

