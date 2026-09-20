import { useMemo, type ComponentType, type ReactNode } from "react";
import {
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import { useBoundScope } from "./boundary.js";
import { getProp } from "./prop.js";
import { FormScopeProvider, narrowScope } from "./scope.js";
import { useRenderers } from "./renderers.js";
import {
  createValidationScope,
  useValidationScope,
  ValidationScopeProvider,
} from "./validationScope.js";
import type { ClassValue, FormProp, FormRenderers, Presence } from "./types.js";

export interface DialogProps {
  /** Authored state — a literal, a derivation, or a control to bind to. */
  open: FormProp<boolean>;
  onClose?: () => void;
  title?: FormProp<ReactNode>;
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
  children: ReactNode;
}

export interface DialogRenderProps {
  open: boolean;
  /**
   * Design mode: render the content in place, no portal, no chrome — the
   * `Dialog → Contents` substitution, done in the boundary so no
   * implementation has to know design mode exists.
   */
  inline: boolean;
  title?: ReactNode;
  /** Already wrapped in its own scope and validation scope. Always mounted. */
  content: ReactNode;
  invalid: boolean;
  onClose(): void;
  hidden: boolean;
  className?: ClassValue;
}

export type DialogImplSource =
  | ComponentType<DialogRenderProps>
  | { key: keyof FormRenderers };

/**
 * The portal container. Its content is `silent` while closed — off screen and
 * still validating, exactly like an inactive tab — which is what lets a
 * trigger outside the dialog report that something inside it is invalid, and
 * what keeps `clearHidden` from wiping a closed dialog's fields.
 *
 * Every implementation must keep the content **mounted** while closed, in one
 * unchanging parent: an unmounted dialog validates nothing, and moving the
 * content between an inline parent and a portal remounts it.
 */
export function dialogRenderer(
  source: DialogImplSource,
): ComponentType<DialogProps> {
  function DialogBoundary(props: DialogProps): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const scope = useBoundScope(props);
    const parentValidation = useValidationScope();

    const open = getProp(rc, props.open) ?? false;
    const inline = scope.designMode;
    const hidden = scope.presence(rc) !== "rendered";
    const presence: Presence = open || inline ? "rendered" : "silent";

    const validation = useMemo(
      () => createValidationScope(ctx, parentValidation, "dialog"),
      [ctx, parentValidation],
    );
    const contentScope = useMemo(
      () => narrowScope(scope, { presence: () => presence }),
      [scope, presence],
    );

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<DialogRenderProps>)
        : source
    ) as ComponentType<DialogRenderProps>;

    return rendered(
      <Impl
        open={open}
        inline={inline}
        title={getProp(rc, props.title)}
        invalid={!validation.isValid(rc)}
        onClose={() => props.onClose?.()}
        hidden={hidden}
        className={getProp(rc, props.className)}
        content={
          <FormScopeProvider scope={contentScope}>
            <ValidationScopeProvider value={validation}>
              {props.children}
            </ValidationScopeProvider>
          </FormScopeProvider>
        }
      />,
    );
  }
  DialogBoundary.displayName = "DialogBoundary";
  return DialogBoundary;
}
