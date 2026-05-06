"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FormOptions } from "./types";
import type { FormRegistry } from "./registry";

const RegistryCtx = createContext<FormRegistry | null>(null);

export function RegistryProvider({
  value,
  children,
}: {
  value: FormRegistry;
  children: ReactNode;
}) {
  return <RegistryCtx.Provider value={value}>{children}</RegistryCtx.Provider>;
}

export function useRegistry(): FormRegistry {
  const r = useContext(RegistryCtx);
  if (!r)
    throw new Error(
      "useRegistry: no FormRegistry in scope. Wrap your form in <Form>.",
    );
  return r;
}

const OptionsCtx = createContext<FormOptions>({});

export function OptionsProvider({
  value,
  children,
}: {
  value: FormOptions;
  children: ReactNode;
}) {
  return <OptionsCtx.Provider value={value}>{children}</OptionsCtx.Provider>;
}

export function useFormOptions(): FormOptions {
  return useContext(OptionsCtx);
}
