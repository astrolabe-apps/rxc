"use client";

import { controls } from "@rxc/controls";
import {
  combineRegistries,
  groupPlugin,
  type FormRegistry,
  type GroupRendererProps,
} from "@rxc/forms-react-core";
import { defaultRegistry, Field } from "@rxc/forms";
import { AllErrors } from "./components/AllErrors";
import { TopLevelGroupValue } from "./formExtensions";
import { PopoverHelpTextAdornment } from "./adornments/PopoverHelpText";

const TopLevelGroup = controls<GroupRendererProps>(
  "TopLevelGroup",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    return (
      <div>
        <AllErrors node={node} />
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);

export function createRegistry(): FormRegistry {
  return combineRegistries(
    groupPlugin({
      type: TopLevelGroupValue,
      component: TopLevelGroup,
    }),
    { adornments: [PopoverHelpTextAdornment] },
    defaultRegistry(),
  );
}
