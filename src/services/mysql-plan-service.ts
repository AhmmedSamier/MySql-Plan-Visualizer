import _ from "lodash"
import { NodeProp } from "@/enums"
import { Node } from "@/interfaces"

export type UnknownPlan = Record<string, unknown>

interface MysqlTable {
  access_type: string
  table_name: string
  rows_examined_per_scan?: number
  rows_produced_per_join?: number
  filtered?: string
  cost_info?: {
    eval_cost?: string
    read_cost?: string
  }
  attached_condition?: string
  used_columns?: string[]
  possible_keys?: string[]
  key?: string
  key_length?: string
  message?: string
}

interface MysqlQueryBlock {
  select_id?: number
  cost_info?: {
    query_cost?: string
  }
  nested_loop?: MysqlQueryBlock[]
  table?: MysqlTable
  ordering_operation?: MysqlQueryBlock
  grouping_operation?: MysqlQueryBlock
  duplicates_removal?: MysqlQueryBlock
  query_block?: MysqlQueryBlock
}

const ACCESS_TYPE_MAP: Record<string, string> = {
  ALL: "Full Table Scan",
  index: "Full Index Scan",
  range: "Index Range Scan",
  ref: "Index Scan",
  eq_ref: "Unique Key Lookup",
  const: "Constant Lookup",
  system: "System",
  fulltext: "Full Text Scan",
  index_merge: "Index Merge",
  unique_subquery: "Unique Subquery",
  index_subquery: "Index Subquery",
}

const V2_PROPERTIES_TO_COPY: string[] = [
  "filtered",
  "cost_info",
  "attached_condition",
  "used_columns",
  "possible_keys",
  "key",
  "key_length",
  "message",
  "select_id",
]

export class MysqlPlanService {
  public isMySQL(data: UnknownPlan): boolean {
    // MySQL V1 has query_block
    // MySQL V2 (explain_json_format_version=2) structure is flexible but usually tree-like
    return (
      _.has(data, "query_block") ||
      _.has(data, "query_spec") ||
      (_.has(data, "execution_plan") && !_.has(data, "Plan")) ||
      _.has(data, "query_plan") ||
      ((_.has(data, "inputs") || _.has(data, "steps")) && !_.has(data, "Plan"))
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public parseMySQL(data: any, flat: Node[]) {
    if (_.has(data, "query_plan")) {
      return this.parseV2(data.query_plan, flat)
    }
    if (_.has(data, "query_block")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryBlock = (data as any).query_block
      if (
        _.has(queryBlock, "inputs") ||
        _.has(queryBlock, "operation") ||
        _.has(queryBlock, "execution_plan")
      ) {
        return this.parseV2(queryBlock, flat)
      }
      return this.parseV1(queryBlock, flat)
    }
    if (_.has(data, "execution_plan")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.parseV2((data as any).execution_plan, flat)
    }
    // Fallback for V2 or other structures
    return this.parseV2(data, flat)
  }

  private parseV1(data: MysqlQueryBlock, flat: Node[]): Node {
    let node: Node

    // Handle nested_loop (Join)
    if (data.nested_loop) {
      // nested_loop is a list of steps. Convert to a left-deep tree or just a sequence.
      // For visualization, we treat the first item as valid, and subsequent items join to it.
      // However, standard visualization expects a global root.
      // We recursively build a tree.
      const children = data.nested_loop.map((child: MysqlQueryBlock) => {
        // Each child usually wraps a table or another construct
        if (child.table) return this.parseTable(child.table, flat)
        if (child.query_block) return this.parseV1(child.query_block, flat)
        return this.parseV1(child, flat) // Fallback
      })

      // Create a root Join node if multiple children
      if (children.length > 1) {
        // Create a left-deep tree: (A JOIN B) JOIN C
        let current = children[0]
        for (let i = 1; i < children.length; i++) {
          const joinNode = new Node("Nested Loops")
          joinNode[NodeProp.PLANS] = [current, children[i]]
          joinNode[NodeProp.NODE_TYPE] = "Nested Loops"
          this.calculateCosts(joinNode, current, children[i])
          flat.push(joinNode)
          current = joinNode
        }
        node = current
      } else {
        node = children[0]
      }
    } else if (data.table) {
      node = this.parseTable(data.table, flat)
    } else if (data.ordering_operation) {
      // Sort
      const child = this.parseV1(data.ordering_operation, flat)
      node = new Node("Sort")
      node[NodeProp.PLANS] = [child]
      flat.push(node)
    } else if (data.grouping_operation) {
      // Group
      const child = this.parseV1(data.grouping_operation, flat)
      node = new Node("Aggregate")
      node[NodeProp.PLANS] = [child]
      flat.push(node)
    } else if (data.duplicates_removal) {
      const child = this.parseV1(data.duplicates_removal, flat)
      node = new Node("Distinct")
      node[NodeProp.PLANS] = [child]
      flat.push(node)
    } else {
      // Generic fallback or root query block properties
      const nodeType = data.select_id ? `Select #${data.select_id}` : "Result"
      node = new Node(nodeType)
      // Check for subqueries etc if needed, or simply return empty node
    }

    // Common properties from query_block level
    if (data.cost_info) {
      node[NodeProp.TOTAL_COST] = parseFloat(data.cost_info.query_cost || "0")
    }

    return node
  }

  private parseTable(data: MysqlTable, flat: Node[]): Node {
    const accessType = data.access_type || "Scan"
    const nodeType = ACCESS_TYPE_MAP[accessType] || accessType
    const node = new Node(nodeType)
    node[NodeProp.RELATION_NAME] = data.table_name
    node[NodeProp.ALIAS] = data.table_name // Usually alias is same or hidden
    node[NodeProp.PLAN_ROWS] =
      data.rows_examined_per_scan || data.rows_produced_per_join || 0

    if (data.filtered) {
      node[NodeProp.FILTERED] = parseFloat(data.filtered)
    }
    if (data.cost_info) {
      node[NodeProp.TOTAL_COST] =
        parseFloat(data.cost_info.eval_cost || "0") +
        parseFloat(data.cost_info.read_cost || "0")
      node[NodeProp.COST_INFO] = data.cost_info
    }

    // MySQL specific props
    if (data.attached_condition)
      node[NodeProp.ATTACHED_CONDITION] = data.attached_condition
    if (data.used_columns) node[NodeProp.USED_COLUMNS] = data.used_columns
    if (data.possible_keys) node[NodeProp.POSSIBLE_KEYS] = data.possible_keys
    if (data.key) node[NodeProp.KEY] = data.key
    if (data.key_length) node[NodeProp.KEY_LENGTH] = data.key_length
    if (data.message) node[NodeProp.MESSAGE] = data.message

    flat.push(node)
    return node
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseV2(data: any, flat: Node[]): Node {
    // V2 is likely tree based with 'inputs'
    let name = data.name || data.operation || "Unknown"
    if (name === "Unknown" && data.select_id) {
      name = `Select #${data.select_id}`
    }
    const mappedName = ACCESS_TYPE_MAP[name] || name
    const node = new Node(mappedName)

    if (data.cost_info) {
      if (data.cost_info.query_cost) {
        node[NodeProp.TOTAL_COST] = parseFloat(data.cost_info.query_cost)
      } else if (data.cost_info.read_cost || data.cost_info.eval_cost) {
        node[NodeProp.TOTAL_COST] =
          parseFloat(data.cost_info.read_cost || "0") +
          parseFloat(data.cost_info.eval_cost || "0")
      }
    }

    // Naive map of properties
    for (const prop of V2_PROPERTIES_TO_COPY) {
      if (data[prop]) {
        node[prop] = data[prop]
      }
    }

    // Explicit mappings
    if (data.table_name) {
      node[NodeProp.RELATION_NAME] = data.table_name
      node[NodeProp.ALIAS] = data.table_name
    }

    // Map rows
    if (
      data.rows_examined_per_scan ||
      data.rows_produced_per_join ||
      data.estimated_rows
    ) {
      node[NodeProp.PLAN_ROWS] =
        data.rows_examined_per_scan ||
        data.rows_produced_per_join ||
        data.estimated_rows ||
        0
    }

    if (data.actual_rows) {
      node[NodeProp.ACTUAL_ROWS] = data.actual_rows
    }

    if (data.actual_loops) {
      node[NodeProp.ACTUAL_LOOPS] = data.actual_loops
    }

    if (data.estimated_total_cost) {
      node[NodeProp.TOTAL_COST] = parseFloat(data.estimated_total_cost)
    }

    if (data.actual_last_row_ms) {
      node[NodeProp.ACTUAL_TOTAL_TIME] = data.actual_last_row_ms
    }

    if (data.actual_first_row_ms) {
      node[NodeProp.ACTUAL_STARTUP_TIME] = data.actual_first_row_ms
    }

    let inputs = data.inputs || data.steps || data.children
    if (!inputs && data.execution_plan) {
      inputs = [data.execution_plan]
    }
    if (inputs && Array.isArray(inputs)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node[NodeProp.PLANS] = inputs.map((child: any) =>
        this.parseV2(child, flat),
      )
    }

    flat.push(node)
    return node
  }

  private calculateCosts(parent: Node, left: Node, right: Node) {
    if (left[NodeProp.TOTAL_COST] && right[NodeProp.TOTAL_COST]) {
      parent[NodeProp.TOTAL_COST] =
        left[NodeProp.TOTAL_COST] + right[NodeProp.TOTAL_COST]
    }
  }
}
