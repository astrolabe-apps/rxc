import { useEffect } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import type { DatePickerProps } from "@rx-controls/forms-native";
import type { DateMode } from "@rx-controls/forms-react";

/**
 * The playground's picker, which `forms-native` leaves to the host (a native module): the
 * platform's own, over `@react-native-community/datetimepicker`, in legacy's three modes. A
 * dialog on Android — a date and then a time for a date and time, which Android cannot pick in
 * one — and a sheet with a spinner on iOS.
 */
const pad = (n: number) => String(n).padStart(2, "0");

/** The value a picker opens on: now for none. */
function parse(mode: DateMode, value: string): Date {
  if (!value) return new Date();
  if (mode === "date") {
    const [y, m, d] = value.split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : new Date();
  }
  if (mode === "time") {
    const [h, min] = value.split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? 0, min ?? 0, 0, 0);
    return d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** A picked date, in the mode's form (`DateMode`). */
function format(mode: DateMode, d: Date): string {
  if (mode === "date") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (mode === "time") return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  return d.toISOString();
}

export function DatePickerHost({ visible, mode, value, onConfirm, onCancel }: DatePickerProps) {
  useEffect(() => {
    if (!visible || Platform.OS !== "android") return;
    const start = parse(mode, value);
    const time = (on: Date) =>
      DateTimePickerAndroid.open({
        mode: "time",
        is24Hour: true,
        value: on,
        onValueChange: (_, t) => {
          const d = new Date(on);
          d.setHours(t.getHours(), t.getMinutes(), 0, 0);
          onConfirm(format(mode, d));
        },
        onDismiss: onCancel,
      });
    if (mode === "time") time(start);
    else
      DateTimePickerAndroid.open({
        mode: "date",
        value: start,
        onValueChange: (_, d) => {
          if (mode === "date") return onConfirm(format(mode, d));
          const on = new Date(d);
          on.setHours(start.getHours(), start.getMinutes(), 0, 0);
          time(on);
        },
        onDismiss: onCancel,
      });
    // opens once per `visible`: the dialog is imperative
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (Platform.OS !== "ios") return null;
  let chosen = parse(mode, value);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" }}>
        <View style={{ backgroundColor: "#fff", padding: 16 }}>
          <DateTimePicker mode={mode} display="spinner" value={chosen} onValueChange={(_, d) => (chosen = d)} />
          <Pressable onPress={() => onConfirm(format(mode, chosen))} style={{ padding: 12 }}>
            <Text>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
