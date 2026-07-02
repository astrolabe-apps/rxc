"use client";

import { useEffect, useRef } from "react";
import { controls } from "@rxc/controls";
import {
  isDataControl,
  type ScrollListRenderOptions,
} from "@rxc/forms-core";
import {
  rendererClass,
  useActionHandler,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const SENTINEL_HEIGHT = 1;

/**
 * Collection-data renderer that pages elements in via an
 * `IntersectionObserver` sentinel at the bottom of the list.
 *
 * The renderer reads `loading` and `hasMore` flags from the bound data
 * control's `meta` (`$scrollList.loading`, `$scrollList.hasMore`) — the
 * host is responsible for keeping these in sync with its data source.
 * When the sentinel becomes visible and `hasMore && !loading`, the
 * renderer dispatches `bottomActionId` via `useActionHandler` so the
 * host can fetch the next page.
 */
export const ScrollListRenderer = controls<DataRendererProps>(
  "ScrollListRenderer",
  ({ node }, { rc }) => {
    const { data, definition } = node.getState(rc);
    const scrollTheme = useHtmlTheme().data.scrollList;
    if (!data) return null;
    const renderOptions = isDataControl(definition)
      ? (definition.renderOptions as ScrollListRenderOptions | undefined)
      : undefined;
    const bottomActionId = renderOptions?.bottomActionId;
    const dispatch = useActionHandler();

    const meta = (data.meta ?? {}) as {
      $scrollList?: { loading?: boolean; hasMore?: boolean };
    };
    const loading = !!meta.$scrollList?.loading;
    const hasMore = !!meta.$scrollList?.hasMore;

    const children = node.getChildren(rc);
    const wrapperClass = rendererClass(
      definition.styleClass,
      scrollTheme.className,
    );

    const fetchMore = () => {
      if (!bottomActionId || !dispatch) return;
      void Promise.resolve(dispatch(bottomActionId, undefined));
    };

    return (
      <div className={wrapperClass}>
        {children.map((child) => (
          <Field key={child.uniqueId} node={child} />
        ))}
        {loading && <div className={scrollTheme.spinnerClass}>Loading…</div>}
        <ScrollSentinel
          enabled={hasMore && !loading && !!bottomActionId}
          onVisible={fetchMore}
        />
      </div>
    );
  },
);

function ScrollSentinel({
  enabled,
  onVisible,
}: {
  enabled: boolean;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Capture latest callback to avoid re-observing on every render.
  const cbRef = useRef(onVisible);
  cbRef.current = onVisible;

  useEffect(() => {
    if (!enabled) return;
    const target = ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cbRef.current();
      },
      { threshold: 0.5 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return <div ref={ref} aria-hidden style={{ height: SENTINEL_HEIGHT }} />;
}
