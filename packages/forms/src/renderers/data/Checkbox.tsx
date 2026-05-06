"use client";

// Re-export BoolRenderer under the Checkbox name for the explicit
// `renderType: "Checkbox"` registration. Same DOM, same behavior, same
// `hidesLabel: true` treatment.
export { BoolRenderer as CheckboxRenderer } from "./Bool";
