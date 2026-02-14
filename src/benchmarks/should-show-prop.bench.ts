import { bench, describe } from "vitest"
import { shouldShowProp } from "@/services/help-service"
import { NodeProp } from "@/enums"

const keysToTest = [
  NodeProp.NODE_TYPE, // In notMiscProperties
  NodeProp.ACTUAL_ROWS, // In notMiscProperties
  "SomeRandomKey", // Not in notMiscProperties
  NodeProp.FILTER, // Not in notMiscProperties
  NodeProp.OUTPUT, // In notMiscProperties
  "AnotherRandomKey",
  NodeProp.CTE_NAME,
  NodeProp.EXCLUSIVE_DURATION,
  NodeProp.EXCLUSIVE_COST,
  NodeProp.TOTAL_COST,
  NodeProp.PLAN_ROWS,
  NodeProp.ACTUAL_LOOPS,
  NodeProp.WORKERS,
  NodeProp.WORKERS_PLANNED,
  NodeProp.WORKERS_LAUNCHED,
  NodeProp.PLANNER_ESTIMATE_FACTOR,
  NodeProp.PLANNER_ESTIMATE_DIRECTION,
  NodeProp.SUBPLAN_NAME,
  NodeProp.GROUP_KEY,
  NodeProp.HASH_CONDITION,
  NodeProp.JOIN_TYPE,
  NodeProp.INDEX_NAME,
  NodeProp.HEAP_FETCHES,
  NodeProp.NODE_ID,
  NodeProp.ROWS_REMOVED_BY_FILTER,
  NodeProp.ROWS_REMOVED_BY_JOIN_FILTER,
  NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK,
  NodeProp.ACTUAL_ROWS_REVISED,
  NodeProp.PLAN_ROWS_REVISED,
  NodeProp.ROWS_REMOVED_BY_FILTER_REVISED,
  NodeProp.ROWS_REMOVED_BY_JOIN_FILTER_REVISED,
  NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK_REVISED,
  "size",
  NodeProp.RELATION_NAME,
  NodeProp.ALIAS,
  NodeProp.FUNCTION_NAME,
  NodeProp.STRATEGY,
  NodeProp.PARTIAL_MODE,
  NodeProp.SCAN_DIRECTION,
  NodeProp.ACTUAL_ROWS_FRACTIONAL,
]

describe("shouldShowProp", () => {
  bench("shouldShowProp Mixed Keys", () => {
    for (const key of keysToTest) {
      shouldShowProp(key, "some value")
    }
  })
})
