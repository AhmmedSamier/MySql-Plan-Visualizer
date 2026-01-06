// Composable for PlanNode and PlanNodeDetail components
import _ from "lodash"
import { computed, onBeforeMount, ref, watch } from "vue"
import type { Node, Worker, ViewOptions } from "@/interfaces"
import {
  NodeProp,
  EstimateDirection,
  HighlightType,
} from "@/enums"
import { cost, duration, factor, formatNodeProp, rows } from "@/filters"
import { numberToColorHsl } from "@/services/color-service"
import { store } from "@/store"

export default function useNode(
  node: Node,
  viewOptions: ViewOptions,
) {
  const executionTimePercent = ref<number>(NaN)
  // UI flags
  // calculated properties
  const costPercent = ref<number>(NaN)
  const barWidth = ref<number>(0)
  const highlightValue = ref<string | null>(null)
  const plannerRowEstimateValue = ref<number>()
  const plannerRowEstimateDirection = ref<EstimateDirection>()
  const rowsRemoved = ref<number>(NaN)
  const rowsRemovedPercent = ref<number>(NaN)
  const rowsRemovedPercentString = ref<string>()

  onBeforeMount(() => {
    calculateBar()
    calculateDuration()
    calculateCost()
    calculateRowsRemoved()
    plannerRowEstimateDirection.value =
      node[NodeProp.PLANNER_ESTIMATE_DIRECTION]
    plannerRowEstimateValue.value = node[NodeProp.PLANNER_ESTIMATE_FACTOR]
  })

  watch(() => viewOptions.highlightType, calculateBar)

  function calculateBar(): void {
    let value: number | undefined
    switch (viewOptions.highlightType) {
      case HighlightType.DURATION:
        value = node[NodeProp.EXCLUSIVE_DURATION]
        if (value === undefined) {
          highlightValue.value = null
          break
        }
        barWidth.value = Math.round(
          value / store.stats.maxDuration * 100
        )
        highlightValue.value = duration(value)
        break
      case HighlightType.ROWS:
        value = node[NodeProp.ACTUAL_ROWS_REVISED]
        if (value === undefined) {
          highlightValue.value = null
          break
        }
        barWidth.value =
          Math.round(
            value / store.stats.maxRows * 100
          ) || 0
        highlightValue.value = rows(value)
        break
      case HighlightType.COST:
        value = node[NodeProp.EXCLUSIVE_COST]
        if (value === undefined) {
          highlightValue.value = null
          break
        }
        barWidth.value = Math.round(
          value / store.stats.maxCost * 100
        )
        highlightValue.value = cost(value)
        break
    }
  }

  const barColor = computed((): string => {
    return numberToColorHsl(barWidth.value)
  })

  const nodeName = computed((): string => {
    let nodeName = isParallelAware.value ? "Parallel " : ""
    nodeName += node[NodeProp.PARTIAL_MODE]
      ? node[NodeProp.PARTIAL_MODE] + " "
      : ""
    nodeName += node[NodeProp.NODE_TYPE]
    if (
      node[NodeProp.SCAN_DIRECTION] &&
      node[NodeProp.SCAN_DIRECTION] !== "Forward"
    ) {
      nodeName += " " + node[NodeProp.SCAN_DIRECTION]
    }
    if (node[NodeProp.JOIN_TYPE]) {
      nodeName = nodeName.replace("Join", `${node[NodeProp.JOIN_TYPE]} Join`);
    }
    return nodeName
  })

  function calculateDuration() {
    // use the first node total time if plan execution time is not available
    const executionTime =
      store.stats.executionTime ||
      (store.plan?.content?.Plan?.[NodeProp.ACTUAL_TOTAL_TIME] as number)
    const duration = node[NodeProp.EXCLUSIVE_DURATION] as number
    executionTimePercent.value = _.round((duration / executionTime) * 100)
  }

  function calculateCost() {
    const maxTotalCost = store.plan?.content.maxTotalCost as number
    const cost = node[NodeProp.EXCLUSIVE_COST] as number
    costPercent.value = _.round((cost / maxTotalCost) * 100)
  }

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

  function calculateRowsRemoved() {
    if (rowsRemovedProp) {
      const removed = node[NodeProp[rowsRemovedProp]] as number
      rowsRemoved.value = removed
      const actual = node[NodeProp.ACTUAL_ROWS_REVISED]
      rowsRemovedPercent.value = _.floor((removed / (removed + actual)) * 100)
      if (rowsRemovedPercent.value === 100) {
        rowsRemovedPercentString.value = ">99"
      } else if (rowsRemovedPercent.value === 0) {
        rowsRemovedPercentString.value = "<1"
      } else {
        rowsRemovedPercentString.value = rowsRemovedPercent.value.toString()
      }
    }
  }

  const durationClass = computed(() => {
    let c
    const i = executionTimePercent.value
    if (i > 90) {
      c = 4
    } else if (i > 40) {
      c = 3
    } else if (i > 10) {
      c = 2
    }
    if (c) {
      return "c-" + c
    }
    return false
  })

  const estimationClass = computed(() => {
    let c
    const i = node[NodeProp.PLANNER_ESTIMATE_FACTOR] as number
    if (i > 1000) {
      c = 4
    } else if (i > 100) {
      c = 3
    } else if (i > 10) {
      c = 2
    }
    if (c) {
      return "c-" + c
    }
    return false
  })

  const costClass = computed(() => {
    let c
    const i = costPercent.value
    if (i > 90) {
      c = 4
    } else if (i > 40) {
      c = 3
    } else if (i > 10) {
      c = 2
    }
    if (c) {
      return "c-" + c
    }
    return false
  })

  const rowsRemovedClass = computed(() => {
    let c
    const i = rowsRemovedPercent.value
    if (i > 90) {
      c = 4
    } else if (i > 50) {
      c = 3
    }
    if (c) {
      return "c-" + c
    }
    return false
  })

  const heapFetchesClass = computed(() => {
    let c
    const i =
      ((node[NodeProp.HEAP_FETCHES] as number) /
        ((node[NodeProp.ACTUAL_ROWS] as number) +
          ((node[NodeProp.ROWS_REMOVED_BY_FILTER] as number) || 0) +
          ((node[NodeProp.ROWS_REMOVED_BY_JOIN_FILTER] as number) || 0))) *
      100
    if (i > 90) {
      c = 4
    } else if (i > 40) {
      c = 3
    } else if (i > 0) {
      c = 2
    }
    if (c) {
      return "c-" + c
    }
    return false
  })

  const filterTooltip = computed((): string => {
    return rowsRemovedPercentString.value + "% of rows removed by filter"
  })

  const filterDetailTooltip = computed((): string => {
    return `Filter used:<br><pre class="mb-0" style="white-space: pre-wrap;"><code>${
      node[NodeProp.FILTER]
    }</code></pre>`
  })

  const indexRecheckTooltip = computed((): string => {
    return `Recheck condition:<br><pre class="mb-0" style="white-space: pre-wrap;"><code>${
      node[NodeProp.RECHECK_COND]
    }</code></pre>`
  })

  const isNeverExecuted = computed((): boolean => {
    return !!store.stats.executionTime && !node[NodeProp.ACTUAL_LOOPS]
  })

  const isParallelAware = computed((): boolean => {
    return node[NodeProp.PARALLEL_AWARE]
  })

  const workersLaunchedCount = computed((): number => {
    console.warn("Make sure it works for workers that are not array")
    if (node[NodeProp.WORKERS_LAUNCHED]) {
      return node[NodeProp.WORKERS_LAUNCHED] as number
    }
    if (node[NodeProp.WORKERS_LAUNCHED_BY_GATHER]) {
      return node[NodeProp.WORKERS_LAUNCHED_BY_GATHER] as number
    }
    const workers = node[NodeProp.WORKERS] as Worker[]
    return workers ? workers.length : NaN
  })

  const workersPlannedCount = computed((): number => {
    return (
      (node[NodeProp.WORKERS_LAUNCHED] as number) ||
      (node[NodeProp.WORKERS_PLANNED_BY_GATHER] as number)
    )
  })

  const workersPlannedCountReversed = computed((): number[] => {
    const workersPlanned = node[NodeProp.WORKERS_PLANNED_BY_GATHER]
    return [...Array(workersPlanned).keys()].slice().reverse()
  })

  const estimateFactorPercent = computed((): number => {
    switch (node[NodeProp.PLANNER_ESTIMATE_FACTOR]) {
      case Infinity:
        return 100
      case 1:
        return 0
      default:
        return (
          ((node[NodeProp.PLANNER_ESTIMATE_FACTOR] || 0) /
            store.stats.maxEstimateFactor) *
          100
        )
    }
  })

  const rowsTooltip = computed((): string => {
    return ["Rows: ", rows(node[NodeProp.ACTUAL_ROWS_REVISED] as number)].join(
      "",
    )
  })

  const estimateFactorTooltip = computed((): string => {
    const estimateFactor = node[NodeProp.PLANNER_ESTIMATE_FACTOR]
    const estimateDirection = node[NodeProp.PLANNER_ESTIMATE_DIRECTION]
    let text = ""
    if (estimateFactor === undefined || estimateDirection === undefined) {
      return "N/A"
    }
    switch (estimateDirection) {
      case EstimateDirection.over:
        text += "Over"
        break
      case EstimateDirection.under:
        text += "Under"
        break
      default:
        text += "Correctly"
    }
    text += " estimated"
    text +=
      estimateFactor !== 1 ? " by <b>" + factor(estimateFactor) + "</b>" : ""
    text += "<br>"
    text += `Rows: ${rows(node[NodeProp.ACTUAL_ROWS_REVISED])} `
    text += `(${rows(node[NodeProp.PLAN_ROWS_REVISED] as number)} planned)`
    return text
  })

  const costTooltip = computed((): string => {
    return ["Cost: ", rows(node[NodeProp.EXCLUSIVE_COST] as number)].join("")
  })

  const rowsRemovedTooltip = computed((): string => {
    return `${NodeProp[rowsRemovedProp]}: ${tilde.value}${rows(rowsRemoved.value)}`
  })

  const rowsIsFractional = computed((): boolean => {
    return !!node[NodeProp.ACTUAL_ROWS_FRACTIONAL]
  })

  const hasSeveralLoops = computed((): boolean => {
    return (node[NodeProp.ACTUAL_LOOPS] as number) > 1
  })

  const tilde = computed((): string => {
    return !rowsIsFractional.value && hasSeveralLoops.value ? "~" : ""
  })

  const heapFetchesTooltip = computed((): string => {
    return `Heap Fetches: ${node[NodeProp.HEAP_FETCHES]?.toLocaleString()}`
  })

  // returns the formatted prop
  function formattedProp(propName: keyof typeof NodeProp) {
    const property = NodeProp[propName]
    const value = node[property]
    return formatNodeProp(property, value)
  }

  return {
    barColor,
    barWidth,
    costClass,
    costTooltip,
    durationClass,
    estimateFactorPercent,
    estimateFactorTooltip,
    estimationClass,
    executionTimePercent,
    filterTooltip,
    filterDetailTooltip,
    formattedProp,
    heapFetchesClass,
    heapFetchesTooltip,
    highlightValue,
    indexRecheckTooltip,
    isNeverExecuted,
    isParallelAware,
    nodeName,
    plannerRowEstimateDirection,
    plannerRowEstimateValue,
    rowsRemoved,
    rowsRemovedClass,
    rowsRemovedPercent,
    rowsRemovedPercentString,
    rowsRemovedProp,
    rowsRemovedTooltip,
    rowsTooltip,
    tilde,
    workersLaunchedCount,
    workersPlannedCount,
    workersPlannedCountReversed,
  }
}
