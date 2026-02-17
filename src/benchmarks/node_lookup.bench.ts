import { bench, describe } from "vitest"

enum NodeProp {
  ROWS_REMOVED_BY_FILTER_REVISED = "*Rows Removed by Filter",
  ROWS_REMOVED_BY_JOIN_FILTER_REVISED = "*Rows Removed by Join Filter",
  ROWS_REMOVED_BY_INDEX_RECHECK_REVISED = "*Rows Removed by Index Recheck",
  // Add some other props to simulate the real enum size slightly
  NODE_TYPE = "Node Type",
  ACTUAL_ROWS = "Actual Rows",
  PLAN_ROWS = "Plan Rows",
  ACTUAL_TOTAL_TIME = "Actual Total Time",
  EXCLUSIVE_COST = "Total Cost",
  EXCLUSIVE_DURATION = "Exclusive Duration",
  PLANNER_ESTIMATE_FACTOR = "Planner Estimate Factor",
  PLANNER_ESTIMATE_DIRECTION = "Planner Estimate Direction",
  WORKERS_PLANNED_BY_GATHER = "Workers Planned By Gather",
  WORKERS_LAUNCHED_BY_GATHER = "Workers Launched By Gather",
}

// Create a mock node object with many keys to simulate real scenario
type BenchmarkNode = { [key: string]: number }
const node: BenchmarkNode = {}
// Add dummy keys
for (let i = 0; i < 50; i++) {
  node[`prop_${i}`] = i
}
// Add one of the target keys
node[NodeProp.ROWS_REMOVED_BY_FILTER_REVISED] = 100

describe("Node Property Lookup", () => {
  bench("Baseline: Object.keys().find()", () => {
    type NodePropStrings = keyof typeof NodeProp
    const nodeKey = Object.keys(node).find(
      (key) =>
        key === NodeProp.ROWS_REMOVED_BY_FILTER_REVISED ||
        key === NodeProp.ROWS_REMOVED_BY_JOIN_FILTER_REVISED ||
        key === NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK_REVISED,
    )
    const rowsRemovedProp: NodePropStrings = Object.keys(NodeProp).find(
      (prop) => NodeProp[prop as NodePropStrings] === nodeKey,
    ) as NodePropStrings
    if (rowsRemovedProp) {
      JSON.stringify(rowsRemovedProp)
    }
  })

  bench("Optimized: Direct Access", () => {
    let nodeKey: string | undefined
    if (node[NodeProp.ROWS_REMOVED_BY_FILTER_REVISED] !== undefined) {
      nodeKey = NodeProp.ROWS_REMOVED_BY_FILTER_REVISED
    } else if (
      node[NodeProp.ROWS_REMOVED_BY_JOIN_FILTER_REVISED] !== undefined
    ) {
      nodeKey = NodeProp.ROWS_REMOVED_BY_JOIN_FILTER_REVISED
    } else if (
      node[NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK_REVISED] !== undefined
    ) {
      nodeKey = NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK_REVISED
    }
    if (nodeKey) {
      JSON.stringify(nodeKey)
    }
  })
})
