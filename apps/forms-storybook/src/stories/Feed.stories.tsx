import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useControlContext, type Rendered, useReactive } from "@rx-controls/react";
import { untrackedRead } from "@rx-controls/core";
import { Feed, TextDisplay } from "@rx-controls/forms-react";
import type { ScopeArgs } from "../support";

interface FeedArgs extends ScopeArgs {
  /** How many messages exist in all. */
  total: number;
  /** How many each batch brings. */
  batch: number;
  /** How long a batch takes to arrive, in ms. */
  delay: number;
  withRefresh: boolean;
}

type Message = { subject: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Inbox(a: FeedArgs): Rendered {
  const { rendered } = useReactive();
  const ctx = useControlContext();
  const messages = useControl<Message[]>(() =>
    Array.from({ length: Math.min(a.batch, a.total) }, (_, i) => ({ subject: `Message ${i + 1}` })),
  );
  const hasMore = useControl(a.total > a.batch);
  // A host's fetch: the next batch from where the list ends, then whether more remain.
  const more = async () => {
    await wait(a.delay);
    const now = untrackedRead.getValue(messages);
    const next = Array.from({ length: Math.min(a.batch, a.total - now.length) }, (_, i) => ({
      subject: `Message ${now.length + i + 1}`,
    }));
    ctx.update((wc) => {
      wc.setValue(messages, [...now, ...next]);
      wc.setValue(hasMore, now.length + next.length < a.total);
    });
  };
  const refresh = async () => {
    await wait(a.delay);
    ctx.update((wc) => {
      wc.setValue(messages, untrackedRead.getValue(messages).slice(0, a.batch));
      wc.setValue(hasMore, a.total > a.batch);
    });
  };
  return rendered(
    // A feed scrolls itself on React Native, so it is given a height to fill.
    <div style={{ height: 420, display: "flex", flexDirection: "column" }}>
      <Feed
        field={messages}
        hasMore={(rc) => rc.getValue(hasMore)}
        onLoadMore={more}
        onRefresh={a.withRefresh ? refresh : undefined}
        empty="No messages"
        end="That's every message."
      >
        {(m) => <TextDisplay text={(rc) => rc.getValue(m.fields.subject)} />}
      </Feed>
    </div>,
  );
}

const meta: Meta<FeedArgs> = {
  title: "Boundaries/Feed",
  render: (a) => <Inbox {...a} />,
  args: { total: 23, batch: 8, delay: 600, withRefresh: true },
};
export default meta;
type Story = StoryObj<FeedArgs>;

/**
 * Infinite scroll: more arrives as the end scrolls into view, or on the web's
 * "Load more"; pull to refresh on React Native.
 */
export const Inbox_: Story = { name: "Inbox" };

/** Nothing to show: the empty state. */
export const Empty: Story = { args: { total: 0 } };
