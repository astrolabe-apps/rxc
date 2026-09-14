"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

export interface MotionVisibilityProps {
  visible: boolean | null;
  children: ReactNode;
}

const DEFAULT_TRANSITION: Transition = { duration: 0.2 };

/**
 * Cross-fade Visibility — replaces `<DefaultVisibility>` from `@rx-controls/forms`.
 *
 * Wraps children in `<AnimatePresence>` + `<motion.div>` so toggling
 * `visible` produces a cross-fade rather than a hard mount/unmount.
 * `visible === null` (the "pending" tri-state) is treated as hidden.
 */
export function FadeVisibility({ visible, children }: MotionVisibilityProps) {
  return (
    <AnimatePresence initial={false}>
      {visible === true && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={DEFAULT_TRANSITION}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Slide-down Visibility — useful for inline error messages or
 * conditionally-revealed form sections.
 */
export function SlideVisibility({ visible, children }: MotionVisibilityProps) {
  return (
    <AnimatePresence initial={false}>
      {visible === true && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={DEFAULT_TRANSITION}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
