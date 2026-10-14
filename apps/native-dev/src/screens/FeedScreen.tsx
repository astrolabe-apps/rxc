import { View } from "react-native";
import { untrackedRead } from "@rx-controls/core";
import { useControl, useControlContext, useReactive, type Rendered } from "@rx-controls/react";
import { Feed, Form, TextDisplay } from "@rx-controls/forms-react";

const TOTAL = 40;
const BATCH = 12;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Infinite scroll, as ServiceTas's inbox: batches of 12 up to 40, arriving after
 * a second; pull down to refresh. Not a Screen: a feed is its own scroll
 * container, so it fills a view rather than sitting in a ScrollView.
 */
export function FeedScreen(): Rendered {
  const { rendered } = useReactive();
  const ctx = useControlContext();
  const messages = useControl(() =>
    Array.from({ length: BATCH }, (_, i) => ({ subject: `Message ${i + 1}` })),
  );
  const hasMore = useControl(true);
  const more = async () => {
    await wait(1000);
    const now = untrackedRead.getValue(messages);
    const next = Array.from({ length: Math.min(BATCH, TOTAL - now.length) }, (_, i) => ({
      subject: `Message ${now.length + i + 1}`,
    }));
    ctx.update((wc) => {
      wc.setValue(messages, [...now, ...next]);
      wc.setValue(hasMore, now.length + next.length < TOTAL);
    });
  };
  const refresh = async () => {
    await wait(1000);
    ctx.update((wc) => {
      wc.setValue(messages, untrackedRead.getValue(messages).slice(0, BATCH));
      wc.setValue(hasMore, true);
    });
  };
  return rendered(
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <Form>
        <Feed
          field={messages}
          hasMore={(rc) => rc.getValue(hasMore)}
          onLoadMore={more}
          onRefresh={refresh}
        >
          {(m) => (
            <View style={{ padding: 16, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8 }}>
              <TextDisplay text={(rc) => rc.getValue(m.fields.subject)} />
            </View>
          )}
        </Feed>
      </Form>
    </View>,
  );
}
