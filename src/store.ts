import _ from "lodash"
import { reactive } from "vue"
import { PlanService } from "@/services/plan-service"
import type { Node, IPlan, IPlanContent, IPlanStats } from "@/interfaces"

type FlattenedNodeMap = Map<number, FlattenedPlanNode>

export interface Store {
  plan?: IPlan
  query?: string
  stats: IPlanStats
  parsing: boolean
  error?: string
  parse(source: string, query: string): Promise<void>
  flat: FlattenedPlanNode[][]
  nodeById?: FlattenedNodeMap
}

export interface FlattenedPlanNode {
  node: Node

  /** Ancestry path */
  path: number[]

  /** Branch continuation flags per depth */
  branches: boolean[]

  level: number
}

const planService = new PlanService()

function flattenPlan(
  root: Node,
  nodeById: FlattenedNodeMap,
): FlattenedPlanNode[] {
  const result: FlattenedPlanNode[] = []

  const visit = (
    node: Node,
    path: number[],
    branches: boolean[],
    level: number,
  ): void => {
    const currentPath = [...path, node.nodeId]

    const flattenedNode = {
      node,
      path: currentPath,
      branches,
      level,
    }
    result.push(flattenedNode)
    nodeById.set(node.nodeId, flattenedNode)

    const children = node.Plans ?? []
    children.forEach((child, index) => {
      const childIsLast = index === children.length - 1

      visit(
        child,
        currentPath,
        [
          ...branches,
          !childIsLast, // ← pipe continues if not last
        ],
        level + 1,
      )
    })
  }

  visit(root, [], [], 0)
  return result
}

function initStats(): IPlanStats {
  return {
    executionTime: NaN,
    planningTime: NaN,
    maxRows: NaN,
    maxCost: NaN,
    maxDuration: NaN,
    maxEstimateFactor: NaN,
  }
}

export function createStore(): Store {
  const store = reactive<Store>({
    flat: [],
    stats: initStats(),
    nodeById: new Map(),
    parsing: false,
    error: undefined,
    async parse(source: string, query: string) {
      store.parsing = true
      store.plan = undefined
      store.stats = initStats()
      store.flat = []
      const nodeById = new Map()
      let planJson: IPlanContent
      try {
        planJson = (await planService.fromSourceAsync(source)) as IPlanContent
      } catch (e) {
        store.plan = undefined
        store.error =
          e instanceof Error ? e.message : "Failed to parse execution plan"
        store.parsing = false
        return
      }
      store.error = undefined
      store.query = planJson["Query Text"] || query
      store.plan = planService.createPlan("", planJson, store.query)

      const content = store.plan.content
      store.stats = {
        executionTime:
          (content["Execution Time"] as number) ||
          (content["Total Runtime"] as number) ||
          (content["execution_time"] as number) ||
          NaN,
        planningTime:
          (content["Planning Time"] as number) ||
          (content["planning_time"] as number) ||
          NaN,
        maxRows: content.maxRows || NaN,
        maxCost: content.maxCost || NaN,
        maxDuration: content.maxDuration || NaN,
        maxEstimateFactor: content.maxEstimateFactor || NaN,
      }

      const flatPlans = []
      flatPlans.push(flattenPlan(store.plan.content.Plan, nodeById))
      _.each(store.plan.ctes, (cte) => {
        flattenPlan(cte, nodeById) // Just fill nodeById
        flatPlans.push(flattenPlan(cte, nodeById))
      })
      store.flat = flatPlans

      store.nodeById = nodeById
      store.parsing = false
    },
  })
  return store
}

// Keep singleton for backward compatibility OR to use during refactor
export const store = createStore()
