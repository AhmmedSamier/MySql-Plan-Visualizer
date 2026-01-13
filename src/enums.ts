export enum Metric {
  time,
  rows,
  cost,
  buffers,
  estimate_factor,
  io,
}

export class HighlightType {
  public static NONE = "none"
  public static DURATION = "duration"
  public static ROWS = "rows"
  public static COST = "cost"
}

export enum SortDirection {
  asc = "asc",
  desc = "desc",
}

export enum EstimateDirection {
  over = 1,
  under = 2,
  none = 3,
}

export enum CenterMode {
  center,
  visible,
  none,
}

export enum Orientation {
  LeftToRight = "LeftToRight",
  TopToBottom = "TopToBottom",
}

export enum NodeProp {
  // plan property keys
  NODE_TYPE = "Node Type",
  ACTUAL_ROWS = "Actual Rows",
  PLAN_ROWS = "Plan Rows",
  PLAN_WIDTH = "Plan Width",
  ROWS_REMOVED_BY_FILTER = "Rows Removed by Filter",
  ROWS_REMOVED_BY_JOIN_FILTER = "Rows Removed by Join Filter",
  ROWS_REMOVED_BY_INDEX_RECHECK = "Rows Removed by Index Recheck",
  ACTUAL_STARTUP_TIME = "Actual Startup Time",
  ACTUAL_TOTAL_TIME = "Actual Total Time",
  ACTUAL_LOOPS = "Actual Loops",
  STARTUP_COST = "Startup Cost",
  TOTAL_COST = "Total Cost",
  PLANS = "Plans",
  RELATION_NAME = "Relation Name",
  SCHEMA = "Schema",
  ALIAS = "Alias",
  GROUP_KEY = "Group Key",
  SORT_KEY = "Sort Key",
  SORT_METHOD = "Sort Method",
  SORT_SPACE_TYPE = "Sort Space Type",
  SORT_SPACE_USED = "Sort Space Used",
  JOIN_TYPE = "Join Type",
  INDEX_NAME = "Index Name",
  HASH_CONDITION = "Hash Cond",
  PARENT_RELATIONSHIP = "Parent Relationship",
  SUBPLAN_NAME = "Subplan Name",
  PARALLEL_AWARE = "Parallel Aware",
  WORKERS = "Workers",
  WORKERS_PLANNED = "Workers Planned",
  WORKERS_LAUNCHED = "Workers Launched",
  OUTPUT = "Output",
  HEAP_FETCHES = "Heap Fetches",
  FILTER = "Filter",
  STRATEGY = "Strategy",
  PARTIAL_MODE = "Partial Mode",
  OPERATION = "Operation",
  RECHECK_COND = "Recheck Cond",
  SCAN_DIRECTION = "Scan Direction",
  // MySQL specific
  USED_COLUMNS = "Used Columns",
  ATTACHED_CONDITION = "Attached Condition",
  POSSIBLE_KEYS = "Possible Keys",
  KEY = "Key",
  KEY_LENGTH = "Key Length",
  ROWS_EXAMINED_PER_SCAN = "Rows Examined per Scan",
  ROWS_PRODUCED_PER_JOIN = "Rows Produced per Join",
  FILTERED = "Filtered",
  COST_INFO = "Cost Info",
  USED_KEY_PARTS = "Used Key Parts",
  MESSAGE = "Message",

  // computed by mpv
  NODE_ID = "nodeId",
  EXCLUSIVE_DURATION = "*Duration (exclusive)",
  EXCLUSIVE_COST = "*Cost (exclusive)",
  ACTUAL_ROWS_REVISED = "*Actual Rows Revised",
  ACTUAL_ROWS_FRACTIONAL = "*Actual Rows Is Fractional",
  PLAN_ROWS_REVISED = "*Plan Rows Revised",
  ROWS_REMOVED_BY_FILTER_REVISED = "*Rows Removed by Filter",
  ROWS_REMOVED_BY_JOIN_FILTER_REVISED = "*Rows Removed by Join Filter",
  ROWS_REMOVED_BY_INDEX_RECHECK_REVISED = "*Rows Removed by Index Recheck",

  PLANNER_ESTIMATE_FACTOR = "*Planner Row Estimate Factor",
  PLANNER_ESTIMATE_DIRECTION = "*Planner Row Estimate Direction",

  WORKERS_PLANNED_BY_GATHER = "*Workers Planned By Gather",
  WORKERS_LAUNCHED_BY_GATHER = "*Workers Launched By Gather",

  CTE_SCAN = "CTE Scan",
  CTE_NAME = "CTE Name",
  FUNCTION_NAME = "Function Name",

  ARRAY_INDEX_KEY = "arrayIndex",

  MPV_PLAN_TAG = "plan_",
}

export enum PropType {
  blocks,
  boolean,
  bytes,
  cost,
  duration,
  estimateDirection,
  factor,
  increment,
  json,
  kilobytes,
  list,
  loops,
  rows,
  sortGroups,
  transferRate,
  jit,
}

export const nodePropTypes: { [key: string]: PropType } = {}

nodePropTypes[NodeProp.ACTUAL_ROWS] = PropType.rows
nodePropTypes[NodeProp.ACTUAL_LOOPS] = PropType.loops
nodePropTypes[NodeProp.PLAN_ROWS] = PropType.rows
nodePropTypes[NodeProp.PLAN_WIDTH] = PropType.bytes
nodePropTypes[NodeProp.ACTUAL_ROWS_REVISED] = PropType.rows
nodePropTypes[NodeProp.ACTUAL_ROWS_FRACTIONAL] = PropType.boolean
nodePropTypes[NodeProp.PLAN_ROWS_REVISED] = PropType.rows
nodePropTypes[NodeProp.ACTUAL_TOTAL_TIME] = PropType.duration
nodePropTypes[NodeProp.ACTUAL_STARTUP_TIME] = PropType.duration
nodePropTypes[NodeProp.STARTUP_COST] = PropType.cost
nodePropTypes[NodeProp.TOTAL_COST] = PropType.cost
nodePropTypes[NodeProp.PARALLEL_AWARE] = PropType.boolean
nodePropTypes[NodeProp.WORKERS] = PropType.json
nodePropTypes[NodeProp.SORT_SPACE_USED] = PropType.kilobytes
nodePropTypes[NodeProp.ROWS_REMOVED_BY_FILTER] = PropType.rows
nodePropTypes[NodeProp.ROWS_REMOVED_BY_JOIN_FILTER] = PropType.rows
nodePropTypes[NodeProp.ROWS_REMOVED_BY_FILTER_REVISED] = PropType.rows
nodePropTypes[NodeProp.ROWS_REMOVED_BY_JOIN_FILTER_REVISED] = PropType.rows
nodePropTypes[NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK] = PropType.rows
nodePropTypes[NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK_REVISED] = PropType.rows
nodePropTypes[NodeProp.HEAP_FETCHES] = PropType.rows
nodePropTypes[NodeProp.OUTPUT] = PropType.list
nodePropTypes[NodeProp.SORT_KEY] = PropType.list
nodePropTypes[NodeProp.USED_COLUMNS] = PropType.list
nodePropTypes[NodeProp.POSSIBLE_KEYS] = PropType.list
nodePropTypes[NodeProp.USED_KEY_PARTS] = PropType.list
nodePropTypes[NodeProp.ROWS_EXAMINED_PER_SCAN] = PropType.rows
nodePropTypes[NodeProp.ROWS_PRODUCED_PER_JOIN] = PropType.rows
nodePropTypes[NodeProp.COST_INFO] = PropType.json

nodePropTypes[NodeProp.EXCLUSIVE_DURATION] = PropType.duration
nodePropTypes[NodeProp.EXCLUSIVE_COST] = PropType.cost

nodePropTypes[NodeProp.PLANNER_ESTIMATE_FACTOR] = PropType.factor
nodePropTypes[NodeProp.PLANNER_ESTIMATE_DIRECTION] = PropType.estimateDirection

export class WorkerProp {
  // plan property keys
  public static WORKER_NUMBER = "Worker Number"
}

nodePropTypes[WorkerProp.WORKER_NUMBER] = PropType.increment
