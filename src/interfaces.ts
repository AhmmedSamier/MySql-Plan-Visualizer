import type { HighlightType, Orientation } from "@/enums"

export interface IPlan {
  id: string
  name: string
  content: IPlanContent
  query: string
  createdOn: Date
  planStats: IPlanStats
  formattedQuery?: string
  ctes: Node[]
  isAnalyze: boolean
  isVerbose: boolean
}

export interface IPlanContent {
  Plan: Node
  maxRows?: number
  maxCost?: number
  maxTotalCost?: number
  maxDuration?: number
  maxEstimateFactor?: number
  "Query Text"?: string
  [k: string]: Node | number | string | undefined
}

export interface IPlanStats {
  executionTime?: number
  planningTime?: number
  maxRows: number
  maxCost: number
  maxDuration: number
  maxEstimateFactor: number
}

import { EstimateDirection, NodeProp } from "@/enums"

// Class to create nodes when parsing text
export class Node {
  nodeId!: number
  size!: [number, number];
  [NodeProp.ACTUAL_LOOPS]!: number;
  [NodeProp.ACTUAL_ROWS]!: number;
  [NodeProp.ACTUAL_ROWS_REVISED]!: number;
  [NodeProp.ACTUAL_STARTUP_TIME]?: number;
  [NodeProp.ACTUAL_TOTAL_TIME]?: number;
  [NodeProp.EXCLUSIVE_COST]!: number;
  [NodeProp.EXCLUSIVE_DURATION]!: number;
  [NodeProp.FILTER]!: string;
  [NodeProp.PLANNER_ESTIMATE_DIRECTION]?: EstimateDirection;
  [NodeProp.PLANNER_ESTIMATE_FACTOR]?: number;
  [NodeProp.INDEX_NAME]?: string;
  [NodeProp.NODE_TYPE]!: string;
  [NodeProp.PARALLEL_AWARE]!: boolean;
  [NodeProp.PLANS]!: Node[];
  [NodeProp.PLAN_ROWS]!: number;
  [NodeProp.PLAN_ROWS_REVISED]?: number;
  [NodeProp.SUBPLAN_NAME]?: string;
  [NodeProp.TOTAL_COST]!: number;
  [NodeProp.WORKERS]?: Worker[];
  [NodeProp.WORKERS_LAUNCHED]?: number;
  [NodeProp.WORKERS_PLANNED]?: number;
  [NodeProp.WORKERS_LAUNCHED_BY_GATHER]?: number;
  [NodeProp.WORKERS_PLANNED_BY_GATHER]?: number;
  [NodeProp.PARTIAL_MODE]!: string;
  [NodeProp.SCAN_DIRECTION]!: string;
  [k: string]:
    | Node[]
    | Worker[]
    | boolean
    | number
    | string
    | string[]
    | undefined
    | [number, number]
    | object
  constructor(type?: string) {
    if (!type) {
      return
    }
    this[NodeProp.NODE_TYPE] = type

    enum ScanAndOperationMatch {
      NodeType = 1,
      RelationName,
      Alias,
    }
    // tslint:disable-next-line:max-line-length
    const scanAndOperationsRegex =
      /^((?:Parallel\s+)?(?:Seq|Tid.*|Bitmap\s+Heap|WorkTable|(?:Async\s+)?Foreign)\s+Scan|Update|Insert|Delete|Merge)\son\s(\S+)(?:\s+(\S+))?$/.exec(
        type,
      )

    enum BitmapMatch {
      NodeType = 1,
      IndexName,
    }
    const bitmapRegex = /^(Bitmap\s+Index\s+Scan)\son\s(\S+)$/.exec(type)
    enum IndexMatch {
      NodeType = 1,
      ScanDirection,
      IndexName,
      RelationName,
      Alias,
    }
    // tslint:disable-next-line:max-line-length
    const indexRegex =
      /^((?:Parallel\s+)?Index(?:\sOnly)?\sScan)(\sBackward)?\susing\s(\S+)\son\s(\S+)(?:\s+(\S+))?$/.exec(
        type,
      )

    enum CteMatch {
      NodeType = 1,
      CteName,
      Alias,
    }
    const cteRegex = /^(CTE\sScan)\son\s(\S+)(?:\s+(\S+))?$/.exec(type)

    enum FunctionMatch {
      NodeType = 1,
      FunctionName,
      Alias,
    }
    const functionRegex = /^(Function\sScan)\son\s(\S+)(?:\s+(\S+))?$/.exec(
      type,
    )
    enum SubqueryMatch {
      NodeType = 1,
      Alias,
    }
    const subqueryRegex = /^(Subquery\sScan)\son\s(.+)$/.exec(type)

    // MySQL specific regex
    enum MysqlFilterMatch {
      NodeType = 1,
      Filter,
    }
    const mysqlFilterRegex = /^(Filter):\s+(.*)$/.exec(type)

    enum MysqlAggregateMatch {
      NodeType = 1,
      Output,
    }
    const mysqlAggregateRegex = /^(Aggregate):\s+(.*)$/.exec(type)

    enum MysqlIndexMatch {
      NodeType = 1,
      RelationName,
      IndexName,
      Extra,
    }
    const mysqlIndexLookupRegex =
      /^(Index\slookup)\son\s(\S+)\susing\s([^\s(]+)(.*)$/.exec(type)

    const mysqlSingleRowIndexLookupRegex =
      /^(Single-row\sindex\slookup)\son\s(\S+)\susing\s([^\s(]+)(.*)$/.exec(
        type,
      )

    const mysqlCoveringIndexLookupRegex =
      /^(Covering\sindex\slookup)\son\s(\S+)\susing\s([^\s(]+)(.*)$/.exec(type)

    enum MysqlTableScanMatch {
      NodeType = 1,
      RelationName,
    }
    const mysqlTableScanRegex = /^(Table\sscan)\son\s(\S+)$/.exec(type)

    if (scanAndOperationsRegex) {
      this[NodeProp.NODE_TYPE] =
        scanAndOperationsRegex[ScanAndOperationMatch.NodeType]
      this[NodeProp.RELATION_NAME] =
        scanAndOperationsRegex[ScanAndOperationMatch.RelationName]
      if (scanAndOperationsRegex[ScanAndOperationMatch.Alias]) {
        this[NodeProp.ALIAS] = scanAndOperationsRegex[
          ScanAndOperationMatch.Alias
        ] as string
      }
    } else if (bitmapRegex) {
      this[NodeProp.NODE_TYPE] = bitmapRegex[BitmapMatch.NodeType]
      this[NodeProp.INDEX_NAME] = bitmapRegex[BitmapMatch.IndexName]
    } else if (indexRegex) {
      this[NodeProp.NODE_TYPE] = indexRegex[IndexMatch.NodeType]
      this[NodeProp.INDEX_NAME] = indexRegex[IndexMatch.IndexName]
      this[NodeProp.SCAN_DIRECTION] = indexRegex[IndexMatch.ScanDirection]
        ? "Backward"
        : "Forward"
      this[NodeProp.RELATION_NAME] = indexRegex[IndexMatch.RelationName]
      if (indexRegex[IndexMatch.Alias]) {
        this[NodeProp.ALIAS] = indexRegex[IndexMatch.Alias]
      }
    } else if (mysqlFilterRegex) {
      this[NodeProp.NODE_TYPE] = mysqlFilterRegex[MysqlFilterMatch.NodeType]
      this[NodeProp.FILTER] = mysqlFilterRegex[MysqlFilterMatch.Filter]
    } else if (mysqlAggregateRegex) {
      this[NodeProp.NODE_TYPE] =
        mysqlAggregateRegex[MysqlAggregateMatch.NodeType]
      this[NodeProp.OUTPUT] = [
        mysqlAggregateRegex[MysqlAggregateMatch.Output] as string,
      ]
    } else if (mysqlIndexLookupRegex) {
      this[NodeProp.NODE_TYPE] = mysqlIndexLookupRegex[MysqlIndexMatch.NodeType]
      this[NodeProp.RELATION_NAME] =
        mysqlIndexLookupRegex[MysqlIndexMatch.RelationName]
      this[NodeProp.INDEX_NAME] =
        mysqlIndexLookupRegex[MysqlIndexMatch.IndexName]
      const extra = mysqlIndexLookupRegex[MysqlIndexMatch.Extra]
      if (extra) {
        this[NodeProp.ATTACHED_CONDITION] = extra.trim()
      }
    } else if (mysqlSingleRowIndexLookupRegex) {
      this[NodeProp.NODE_TYPE] =
        mysqlSingleRowIndexLookupRegex[MysqlIndexMatch.NodeType]
      this[NodeProp.RELATION_NAME] =
        mysqlSingleRowIndexLookupRegex[MysqlIndexMatch.RelationName]
      this[NodeProp.INDEX_NAME] =
        mysqlSingleRowIndexLookupRegex[MysqlIndexMatch.IndexName]
      const extra = mysqlSingleRowIndexLookupRegex[MysqlIndexMatch.Extra]
      if (extra) {
        this[NodeProp.ATTACHED_CONDITION] = extra.trim()
      }
    } else if (mysqlCoveringIndexLookupRegex) {
      this[NodeProp.NODE_TYPE] =
        mysqlCoveringIndexLookupRegex[MysqlIndexMatch.NodeType]
      this[NodeProp.RELATION_NAME] =
        mysqlCoveringIndexLookupRegex[MysqlIndexMatch.RelationName]
      this[NodeProp.INDEX_NAME] =
        mysqlCoveringIndexLookupRegex[MysqlIndexMatch.IndexName]
      const extra = mysqlCoveringIndexLookupRegex[MysqlIndexMatch.Extra]
      if (extra) {
        this[NodeProp.ATTACHED_CONDITION] = extra.trim()
      }
    } else if (mysqlTableScanRegex) {
      this[NodeProp.NODE_TYPE] =
        mysqlTableScanRegex[MysqlTableScanMatch.NodeType]
      this[NodeProp.RELATION_NAME] =
        mysqlTableScanRegex[MysqlTableScanMatch.RelationName]
    } else if (cteRegex) {
      this[NodeProp.NODE_TYPE] = cteRegex[CteMatch.NodeType]
      this[NodeProp.CTE_NAME] = cteRegex[CteMatch.CteName]
      if (cteRegex[CteMatch.Alias]) {
        this[NodeProp.ALIAS] = cteRegex[CteMatch.Alias]
      }
    } else if (functionRegex) {
      this[NodeProp.NODE_TYPE] = functionRegex[FunctionMatch.NodeType]
      this[NodeProp.FUNCTION_NAME] = functionRegex[FunctionMatch.FunctionName]
      if (functionRegex[FunctionMatch.Alias]) {
        this[NodeProp.ALIAS] = functionRegex[FunctionMatch.Alias]
      }
    } else if (subqueryRegex) {
      this[NodeProp.NODE_TYPE] = subqueryRegex[SubqueryMatch.NodeType]
      this[NodeProp.ALIAS] = subqueryRegex[SubqueryMatch.Alias]
    }
    enum ParallelMatch {
      NodeType = 2,
    }
    const parallelRegex = /^(Parallel\s+)(.*)/.exec(
      <string>this[NodeProp.NODE_TYPE],
    )
    if (parallelRegex) {
      this[NodeProp.NODE_TYPE] = parallelRegex[ParallelMatch.NodeType]
      this[NodeProp.PARALLEL_AWARE] = true
    }

    enum JoinMatch {
      NodeType = 1,
    }
    const joinRegex = /(.*)\sJoin$/.exec(<string>this[NodeProp.NODE_TYPE])

    enum JoinModifierMatch {
      NodeType = 1,
      JoinType,
    }
    const joinModifierRegex = /(.*)\s+(Full|Left|Right|Anti)/.exec(
      <string>this[NodeProp.NODE_TYPE],
    )
    if (joinRegex) {
      this[NodeProp.NODE_TYPE] = joinRegex[JoinMatch.NodeType]
      if (joinModifierRegex) {
        this[NodeProp.NODE_TYPE] = joinModifierRegex[JoinModifierMatch.NodeType]
        this[NodeProp.JOIN_TYPE] = joinModifierRegex[JoinModifierMatch.JoinType]
      }
      this[NodeProp.NODE_TYPE] += " Join"
    }
  }
}

import { WorkerProp } from "@/enums"
// Class to create workers when parsing text
export class Worker {
  [k: string]: string | number | object
  constructor(workerNumber: number) {
    this[WorkerProp.WORKER_NUMBER] = workerNumber
  }
}

export type ViewOptions = {
  showHighlightBar: boolean
  showPlanStats: boolean
  highlightType: HighlightType
  diagramWidth: number
  orientation: Orientation
}

export type StatsTableItemType = {
  name: string
  count: number
  time: number
  timePercent: number
  nodes: Node[]
}

// A plan node with id, node, isLastSibling, branches
export type Row = [number, Node, boolean, number[]]
