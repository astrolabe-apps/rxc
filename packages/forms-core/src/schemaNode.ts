import type { ReadContext } from "@rxc/controls-core";
import type { SchemaField, CompoundField } from "./json/schemaField";
import { isCompoundField, missingField, FieldType } from "./json/schemaField";
import type { SchemaNode } from "./types";

/**
 * Lookup for resolving schema references.
 */
export interface SchemaTreeLookup {
  getSchema(schemaId: string): SchemaNode | undefined;
}

class SchemaNodeImpl implements SchemaNode {
  constructor(
    private _field: SchemaField,
    public parent: SchemaNode | undefined,
    private lookup?: SchemaTreeLookup,
    private _getChildFields?: () => SchemaField[],
  ) {}

  getField(_rc: ReadContext): SchemaField {
    return this._field;
  }

  private getUnresolvedFields(): SchemaField[] {
    if (this._getChildFields) return this._getChildFields();
    const f = this._field;
    return isCompoundField(f) ? f.children : [];
  }

  private getResolvedParent(noRecurse?: boolean): SchemaNode {
    const f = this._field;
    if (!isCompoundField(f)) return this;
    if (f.schemaRef && this.lookup) {
      const ref = this.lookup.getSchema(f.schemaRef);
      if (ref) return ref;
    }
    if (!noRecurse && f.treeChildren && this.parent) {
      const parentImpl = this.parent as SchemaNodeImpl;
      return parentImpl.getResolvedParent();
    }
    return this;
  }

  getChildren(_rc: ReadContext): SchemaNode[] {
    const resolved = this.getResolvedParent();
    const resolvedImpl = resolved as SchemaNodeImpl;
    const fields = resolvedImpl.getUnresolvedFields();
    return fields.map(
      (f) => new SchemaNodeImpl(f, this, this.lookup),
    );
  }

  getChildNode(_rc: ReadContext, field: string): SchemaNode {
    const resolved = this.getResolvedParent();
    const resolvedImpl = resolved as SchemaNodeImpl;
    const fields = resolvedImpl.getUnresolvedFields();
    const childField = fields.find((f) => f.field === field) ?? missingField(field);
    return new SchemaNodeImpl(childField, this, this.lookup);
  }
}

/**
 * Create a root SchemaNode from an array of schema fields.
 */
export function createSchemaNode(
  fields: SchemaField[],
  lookup?: SchemaTreeLookup,
): SchemaNode {
  const rootField: CompoundField = {
    type: FieldType.Compound,
    field: "",
    children: fields,
  };
  return new SchemaNodeImpl(rootField, undefined, lookup);
}

/**
 * Create a SchemaNode for a single field.
 */
export function createChildSchemaNode(
  field: SchemaField,
  parent?: SchemaNode,
  lookup?: SchemaTreeLookup,
): SchemaNode {
  return new SchemaNodeImpl(field, parent, lookup);
}