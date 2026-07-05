"use client";

import { useEffect, useRef } from "react";
import { controls } from "@rxc/controls";
import {
  rendererClass,
  useScrollListController,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const SENTINEL_HEIGHT = 1;

/**
 * Collection-data renderer that pages elements in via an
 * `IntersectionObserver` sentinel at the bottom of the list.
 *
 * The controller reads `loading` / `hasMore` from the bound control's
 * `meta` (`$scrollList.loading` / `$scrollList.hasMore`) — the host keeps
 * these in sync with its data source — and exposes the paging trigger. When
 * the sentinel becomes visible (and the controller says it's enabled) the
 * renderer fires `onSentinelVisible`, which dispatches the configured
 * `bottomActionId` so the host can fetch the next page.
 */
export const ScrollListRenderer = controls<DataRendererProps>(
  "ScrollListRenderer",
  ({ node }, { rc }) => {
    const c = useScrollListController(rc, node);
    const scrollTheme = useHtmlTheme().data.scrollList;
    if (!c.data) return null;
    const wrapperClass = rendererClass(c.styleClass, scrollTheme.className);

    return (
      <div className={wrapperClass}>
        {c.children.map((child) => (
          <Field key={child.uniqueId} node={child} />
        ))}
        {c.loading && <div className={scrollTheme.spinnerClass}>Loading…</div>}
        <ScrollSentinel
          enabled={c.sentinelEnabled}
          onVisible={c.onSentinelVisible}
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
