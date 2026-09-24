import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import type {
  FieldShellProps,
  FormRenderers,
  InputFrameProps,
  StackProps,
} from "./types.js";

const RendererContext = createContext<FormRenderers | null>(null);

export function useRenderers(): FormRenderers {
  const r = useContext(RendererContext);
  if (!r)
    throw new Error(
      "No form implementation found. Wrap the app in <FormProvider renderers={…}>.",
    );
  return r;
}

/**
 * Sits at the app root and is about implementation, not about any one form.
 * Mounts the implementation's own root (README finding 1) when it declares one.
 */
export function FormProvider({
  renderers,
  children,
}: {
  renderers: FormRenderers;
  children: ReactNode;
}) {
  const Root = renderers.root;
  return (
    <RendererContext value={renderers}>
      {Root ? <Root>{children}</Root> : children}
    </RendererContext>
  );
}

/** Resolved from the active implementation — chrome reuse without importing it. */
export function useFieldShell(): ComponentType<FieldShellProps> {
  return useRenderers().fieldShell;
}

export function useInputFrame(): ComponentType<InputFrameProps> {
  return useRenderers().inputFrame;
}

export function useStack(): ComponentType<StackProps> {
  return useRenderers().stack;
}

/** The layout box as a component, for code that cannot call the hook — the loader. */
export function Stack(props: StackProps) {
  const S = useStack();
  return <S {...props} />;
}
