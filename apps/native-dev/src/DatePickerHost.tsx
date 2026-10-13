import { useEffect } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import type { DatePickerProps } from "@rx-controls/forms-native";

/**
 * The playground's date picker, which `forms-native` leaves to the host (a native module):
 * the platform's own, over `@react-native-community/datetimepicker`. A dialog on Android, a
 * sheet with a spinner on iOS.
 */
const parse = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function DatePickerHost({ visible, value, onConfirm, onCancel }: DatePickerProps) {
  useEffect(() => {
    if (!visible || Platform.OS !== "android") return;
    DateTimePickerAndroid.open({
      mode: "date",
      value: parse(value),
      onValueChange: (_, d) => onConfirm(toIso(d)),
      onDismiss: onCancel,
    });
    // opens once per `visible`: the dialog is imperative
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (Platform.OS !== "ios") return null;
  let chosen = parse(value);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" }}>
        <View style={{ backgroundColor: "#fff", padding: 16 }}>
          <DateTimePicker mode="date" display="spinner" value={chosen} onValueChange={(_, d) => (chosen = d)} />
          <Pressable onPress={() => onConfirm(toIso(chosen))} style={{ padding: 12 }}>
            <Text>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
