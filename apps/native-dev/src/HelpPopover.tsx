import { useRef, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useNativeTheme, type HelpRenderProps } from "@rx-controls/forms-native";

/**
 * ServiceTas's help on a device, which `forms-native` leaves to the theme (`shell.renderHelp`):
 * legacy's `createRNHelpTextRenderer` — the trigger at the label's end, styled as the theme's help
 * button, and the help in a dark bubble above it with a caret beneath, gone on a tap anywhere.
 */
const BUBBLE_WIDTH = 256;
const GUTTER = 8;

export function HelpPopover({ help, label, name, icon }: HelpRenderProps) {
  const button = useNativeTheme().shell.helpButton;
  const trigger = useRef<View>(null);
  const [at, setAt] = useState<{ x: number; y: number; width: number }>();
  const [height, setHeight] = useState(0);
  const { width: screen } = useWindowDimensions();
  const open = () => trigger.current?.measureInWindow((x, y, width) => setAt({ x, y, width }));
  const close = () => {
    setAt(undefined);
    setHeight(0);
  };
  const centre = at ? at.x + at.width / 2 : 0;
  const left = Math.min(Math.max(GUTTER, centre - BUBBLE_WIDTH / 2), screen - BUBBLE_WIDTH - GUTTER);
  return (
    <>
      <Pressable
        ref={trigger}
        role="button"
        aria-label={name}
        aria-expanded={!!at}
        onPress={open}
        style={[button.style, label != null && button.labelled]}
      >
        {icon}
        {label != null && (
          <Text aria-hidden style={button.label}>
            {label}
          </Text>
        )}
      </Pressable>
      <Modal transparent visible={!!at} onRequestClose={close}>
        <Pressable style={{ flex: 1 }} onPress={close} aria-label="Close help">
          {at && (
            // Drawn once unseen to learn its height, then placed above the trigger.
            <View
              onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
              style={{ position: "absolute", left, top: at.y - height - 4, width: BUBBLE_WIDTH, opacity: height ? 1 : 0 }}
            >
              <View style={{ borderRadius: 6, backgroundColor: "#171717", paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ color: "white", fontSize: 16, lineHeight: 20, fontFamily: "Nunito_400Regular" }}>
                  {help}
                </Text>
              </View>
              <View
                style={{
                  marginLeft: centre - left - 6,
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6,
                  borderRightWidth: 6,
                  borderTopWidth: 6,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderTopColor: "#171717",
                }}
              />
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
