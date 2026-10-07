import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pressable, Text, TextInput, View } from "react-native";

/**
 * What the suites can and cannot see. They render React Native through
 * react-native-web, so these pin how its accessibility props reach the DOM —
 * the facts the implementation's both-targets accessibility rests on.
 */
describe("React Native's accessibility props, through react-native-web", () => {
  let logged: string[];
  const mount = (ui: React.ReactNode) => {
    logged = [];
    for (const l of ["error", "warn"] as const)
      vi.spyOn(console, l).mockImplementation((...a) => void logged.push(a.map(String).join(" ")));
    const el = document.createElement("div");
    document.body.appendChild(el);
    act(() => createRoot(el).render(ui));
    return el;
  };
  afterEach(() => {
    vi.restoreAllMocks();
    expect(logged).toEqual([]);
  });

  it("passes every aria-* prop to the DOM, native-supported or not", () => {
    const el = mount(
      <TextInput
        id="f"
        aria-label="Name"
        aria-labelledby="lbl"
        {...({ "aria-describedby": "help", "aria-invalid": true, "aria-required": true } as object)}
      />,
    );
    const input = el.querySelector("#f")!;
    // Native React Native has none of the last three: the suite cannot tell.
    expect(
      ["aria-label", "aria-labelledby", "aria-describedby", "aria-invalid", "aria-required"].map(
        (a) => input.getAttribute(a),
      ),
    ).toEqual(["Name", "lbl", "help", "true", "true"]);
  });

  it("drops accessibilityHint, native's description", () => {
    const el = mount(<TextInput id="f" accessibilityHint="Help words" />);
    expect(el.querySelector("#f")!.outerHTML).not.toContain("Help words");
  });

  it("maps roles to elements: a heading, a button", () => {
    const el = mount(
      <View>
        <Text role="heading" aria-level={2}>
          Title
        </Text>
        <Pressable role="button" onPress={() => {}}>
          <Text>Go</Text>
        </Pressable>
      </View>,
    );
    expect([el.querySelector("h2")?.textContent, el.querySelector("button")?.textContent]).toEqual([
      "Title",
      "Go",
    ]);
  });
});
