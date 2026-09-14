"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import {
  combineRegistries,
  groupPlugin,
  type AnyAdornmentRegistration,
  type FormRegistry,
  type GroupRendererProps,
} from "@rx-controls/forms-react-core";
import { defaultRegistry, Field, useHtmlTheme } from "@rx-controls/forms";
import { dataGridRegistry, type DataGridClasses } from "@rx-controls/forms-datagrid";
import { AllErrors } from "./components/AllErrors";
import { TopLevelGroupValue } from "./formExtensions";
import { PopoverHelpTextAdornment } from "./adornments/PopoverHelpText";

function TopLevelGroup({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const children = node.getChildren(rc);
  const groupClass = useHtmlTheme().group?.standardClass;
  return rendered(
    <div className={groupClass}>
      <AllErrors node={node} />
      {children.map((c) => (
        <Field key={c.uniqueId} node={c} />
      ))}
    </div>
  );
}

export function createRegistry(gridClasses?: DataGridClasses): FormRegistry {
  return combineRegistries(
    groupPlugin({
      type: TopLevelGroupValue,
      component: TopLevelGroup,
    }),
    {
      adornments: [PopoverHelpTextAdornment as unknown as AnyAdornmentRegistration],
    },
    dataGridRegistry(gridClasses),
    defaultRegistry(),
  );
}
