import type { Control, ControlContext } from "@rx-controls/core";

/**
 * A feed's state, as legacy's host code keeps it: three controls on the
 * array control's `meta`, under legacy's own keys — so `feedState(list, ctx)`
 * is `getLoadingControl(list)` / `getHasMoreControl(list)` /
 * `getRefreshingControl(list)` from `@astroapps/forms-core`, and a host ports
 * by changing the import. The JSON path's `ScrollList` reads them.
 *
 * @group Hosts
 */
export interface FeedState {
  /** A batch is loading: the host's own fetch, a first search. */
  loading: Control<boolean>;
  /** Another batch exists. */
  hasMore: Control<boolean>;
  /** A refresh is running. */
  refreshing: Control<boolean>;
}

/**
 * The {@link FeedState} for an array, created on first use (all `false`) and
 * kept on its `meta` — the same controls legacy's helpers made there, if they
 * already did.
 *
 * @group Hosts
 */
export function feedState(control: Control<unknown>, ctx: ControlContext): FeedState {
  const meta = control.meta;
  const get = (key: string) => (meta[key] ??= ctx.newControl(false)) as Control<boolean>;
  return { loading: get("loading"), hasMore: get("hasMore"), refreshing: get("refreshing") };
}
