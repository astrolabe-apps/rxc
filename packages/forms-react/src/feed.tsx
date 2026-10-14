import { useRef, useState, type ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  collectionRenderer,
  type CollectionElement,
  type CollectionRenderProps,
} from "./collection.js";
import type { FieldProps, FieldRenderProps } from "./field.js";
import { getProp, type FormProp } from "./props.js";
import { useRenderers } from "./registry.js";

/**
 * A read-only list that grows as it is scrolled: infinite scroll. Reaching the
 * end asks for the next batch (`onLoadMore`), which the author appends to the
 * array; nothing is ever replaced except by a refresh (`onRefresh`). Legacy's
 * `ScrollList` render type.
 *
 * A feed is a collection — rows keyed by their control's `uniqueId`, each in
 * its own tracking window, the boundary subscribed to structure only — with no
 * add, remove or reorder: its rows are what the host fetched. A row may still
 * hold actions of its own ("View", "Renew").
 *
 * The boundary keeps legacy's guards, so an implementation need not: asking
 * for more while a batch is loading, while refreshing, while locked, or once
 * `hasMore` is false does nothing.
 *
 * On React Native the feed is its own scroll container (a `FlatList`: the
 * only way to virtualise and to pull to refresh), so a form holding one must
 * not sit inside another vertical `ScrollView`.
 *
 * @group Authoring
 */
export interface FeedProps<T> extends FieldProps<T[]> {
  /** One row, given its element's control. */
  children: (item: Control<T>, index: number) => ReactNode;
  /**
   * Fetch the next batch and append it to the array. A returned promise is
   * the feed's loading state until it settles, as an action's `busy` is.
   */
  onLoadMore?: () => unknown;
  /**
   * Start again from the first batch — pull to refresh. Refreshing until a
   * returned promise settles. Left out, the feed offers no refresh.
   */
  onRefresh?: () => unknown;
  /** Whether another batch exists. Default `false`: nothing is asked for. */
  hasMore?: FormProp<boolean>;
  /**
   * Loading the feed did not start itself — a first search, a filter changed
   * elsewhere. Or'd with `onLoadMore`'s own promise.
   */
  loading?: FormProp<boolean>;
  /** A refresh the feed did not start itself, as `loading`. */
  refreshing?: FormProp<boolean>;
  /**
   * Shown when there are no rows and nothing is loading. Left out, the
   * implementation's own (its theme's): React Native's says "No results found",
   * as legacy's did; the web's shows nothing.
   */
  empty?: ReactNode;
  /**
   * Shown after the last row once there is no more to load. Left out, the
   * implementation's own, as `empty`.
   */
  end?: ReactNode;
}

/**
 * What the `feed` slot receives: the rows, prepared as a collection's are,
 * and the state and requests to draw them with. The boundary has resolved
 * every prop and folded in the handlers' own promises.
 *
 * Asking for more (`loadMore`) is safe at any time: the boundary drops a
 * request while loading, refreshing or locked, or with `hasMore` false. So an
 * implementation may wire it straight to its trigger — `onEndReached`, an
 * `IntersectionObserver`, a "Load more" button — however often that fires.
 *
 * @group Implementations
 */
export interface FeedRenderProps<T> extends FieldRenderProps<T[]> {
  /** The rows. */
  elements: CollectionElement<T>[];
  /** A batch is loading: `onLoadMore`'s promise, or the author's `loading`. */
  loading: boolean;
  /** A refresh is running: `onRefresh`'s promise, or the author's `refreshing`. */
  refreshing: boolean;
  /** Another batch exists. */
  hasMore: boolean;
  /** Ask for the next batch. A no-op whenever there is nothing to ask for. */
  loadMore(): void;
  /** Start again. Absent when the author gave no `onRefresh`: offer no refresh. */
  refresh?: () => void;
  /** The author's empty state, or `undefined` for the implementation's own. */
  empty?: ReactNode;
  /** The author's end of the list, or `undefined` for the implementation's own. */
  end?: ReactNode;
}

/** What the inner part receives: the collection's render props and the feed's own. */
type FeedInner = CollectionRenderProps<unknown> &
  Pick<FeedProps<unknown>, "onLoadMore" | "onRefresh" | "hasMore" | "loading" | "refreshing" | "end">;

/**
 * The feed's own part, inside the collection boundary that prepared its rows:
 * resolves the paging state, folds in the handlers' promises, and keeps the
 * guards, then hands the `feed` slot what it draws.
 */
function FeedImpl(p: FeedInner): Rendered {
  const { rc, rendered } = useReactive();
  const { feed: Slot } = useRenderers();
  // In flight: a ref, so two triggers in one tick ask once; state, so the
  // slot re-renders with the spinner.
  const [loadingOwn, setLoadingOwn] = useState(false);
  const [refreshingOwn, setRefreshingOwn] = useState(false);
  const inFlight = useRef(false);
  const loading = loadingOwn || !!getProp(rc, p.loading);
  const refreshing = refreshingOwn || !!getProp(rc, p.refreshing);
  const hasMore = !!getProp(rc, p.hasMore);
  // A locked feed asks for nothing: its actions say so.
  const locked = !p.actions.canEdit;

  const run = (handler: () => unknown, set: (busy: boolean) => void) => {
    inFlight.current = true;
    let result: unknown;
    try {
      result = handler();
    } catch (e) {
      inFlight.current = false;
      throw e;
    }
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      set(true);
      const done = () => {
        inFlight.current = false;
        set(false);
      };
      (result as PromiseLike<unknown>).then(done, done);
    } else inFlight.current = false;
  };

  const { onLoadMore, onRefresh, loading: _l, refreshing: _r, hasMore: _h, end, ...collection } = p;
  const props: FeedRenderProps<unknown> = {
    ...collection,
    loading,
    refreshing,
    hasMore,
    loadMore: () => {
      if (!onLoadMore || inFlight.current || loading || refreshing || locked || !hasMore) return;
      run(onLoadMore, setLoadingOwn);
    },
    refresh: onRefresh
      ? () => {
          if (inFlight.current || loading || refreshing || locked) return;
          run(onRefresh, setRefreshingOwn);
        }
      : undefined,
    end,
  };
  return rendered(<Slot {...props} />);
}

/**
 * Infinite scroll: a read-only list that grows as it is scrolled. See
 * {@link FeedProps}.
 *
 * @group Authoring
 */
export const Feed: <T>(props: FeedProps<T>) => Rendered = collectionRenderer<
  unknown,
  Pick<FeedProps<unknown>, "onLoadMore" | "onRefresh" | "hasMore" | "loading" | "refreshing" | "end">
>(FeedImpl) as never;
