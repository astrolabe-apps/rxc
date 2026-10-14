import { useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";

/**
 * Which converted form is drawn: one bar naming it, opening a searchable list — the chips it
 * replaces took most of the screen once every form had one.
 */
export function FormPicker({
  names,
  value,
  onChange,
}: {
  names: readonly string[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const shown = names.filter((n) => n.toLowerCase().includes(filter.trim().toLowerCase()));
  const pick = (n: string) => {
    setOpen(false);
    setFilter("");
    onChange(n);
  };
  return (
    <>
      <Pressable
        role="button"
        aria-label={`Form: ${value}`}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginHorizontal: 12,
          marginVertical: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: "#f3f4f6",
        }}
      >
        <Text style={{ color: "#111827", fontWeight: "600" }}>{value}</Text>
        <Text style={{ color: "#6b7280" }}>{"▾"}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, paddingTop: 36, backgroundColor: "#fff" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12 }}>
            <TextInput
              autoFocus
              placeholder="Find a form"
              value={filter}
              onChangeText={setFilter}
              style={{ flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
            />
            <Pressable role="button" onPress={() => setOpen(false)} style={{ padding: 8 }}>
              <Text style={{ color: "#2563eb" }}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={shown}
            keyExtractor={(n) => n}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                role="button"
                onPress={() => pick(item)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                  backgroundColor: item === value ? "#eff6ff" : "#fff",
                }}
              >
                <Text style={{ color: "#111827" }}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
