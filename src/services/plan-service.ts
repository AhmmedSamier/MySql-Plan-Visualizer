import _ from "lodash"
import { EstimateDirection, NodeProp } from "@/enums"
import type { IPlan, IPlanContent, IPlanStats } from "@/interfaces"
import { Node, Worker } from "@/interfaces"
import { PlanParser } from "@/services/plan-parser"
// Worker is imported dynamically in fromSourceAsync to avoid load-time issues in tests

type recurseItemType = Array<[Node, recurseItemType]>

export class PlanService {
  private nodeId = 0
  private flat: Node[] = []
  private parser = new PlanParser()

  private recurse(nodes: Node[]): recurseItemType {
    return _.map(nodes, (node) => [node, this.recurse(node[NodeProp.PLANS])])
  }

  public createPlan(
    planName: string,
    planContent: IPlanContent,
    planQuery: string,
  ): IPlan {
    // remove any extra white spaces in the middle of query
    // (\S) start match after any non-whitespace character => group 1
    // (?!$) don't start match after end of line
    // (\s{2,}) group of 2 or more white spaces
    // '$1 ' reuse group 1 and and a single space
    planQuery = planQuery.replace(/(\S)(?!$)(\s{2,})/gm, "$1 ")

    const plan: IPlan = {
      id: NodeProp.MPV_PLAN_TAG + new Date().getTime().toString(),
      name: planName || "plan created on " + new Date().toDateString(),
      createdOn: new Date(),
      content: planContent,
      query: planQuery,
      planStats: {} as IPlanStats,
      ctes: [],
      isAnalyze: _.has(planContent.Plan, NodeProp.ACTUAL_ROWS),
      isVerbose: this.findOutputProperty(planContent.Plan),
    }

    this.nodeId = 1
    this.flat = []
    this.processNode(planContent.Plan, plan)

    this.flat = this.flat.concat(
      _.flattenDeep(this.recurse([plan.content.Plan as Node])),
    )
    _.each(plan.ctes, (cte) => {
      this.flat = this.flat.concat(_.flattenDeep(this.recurse([cte as Node])))
    })

    this.fixCteScansDuration(plan)
    this.fixInitPlanUsageDuration(plan)
    this.calculateMaximums(plan)
    return plan
  }

  public isCTE(node: Node) {
    return (
      node[NodeProp.PARENT_RELATIONSHIP] === "InitPlan" &&
      _.startsWith(node[NodeProp.SUBPLAN_NAME], "CTE")
    )
  }

  // recursively walk down the plan to compute various metrics
  public processNode(node: Node, plan: IPlan) {
    node.nodeId = this.nodeId++
    this.calculatePlannerEstimate(node)
    this.calculateSearchString(node)

    _.each(node[NodeProp.PLANS], (child) => {
      // Disseminate workers planned info to parallel nodes (ie. Gather children)
      if (
        !this.isCTE(child) &&
        child[NodeProp.PARENT_RELATIONSHIP] !== "InitPlan" &&
        child[NodeProp.PARENT_RELATIONSHIP] !== "SubPlan"
      ) {
        child[NodeProp.WORKERS_PLANNED_BY_GATHER] =
          node[NodeProp.WORKERS_PLANNED] ||
          node[NodeProp.WORKERS_PLANNED_BY_GATHER]
        child[NodeProp.WORKERS_LAUNCHED_BY_GATHER] =
          node[NodeProp.WORKERS_LAUNCHED] ||
          node[NodeProp.WORKERS_LAUNCHED_BY_GATHER]
      }
      if (this.isCTE(child)) {
        plan.ctes.push(child)
      }
      this.processNode(child, plan)
    })

    _.remove(node[NodeProp.PLANS], (child) => this.isCTE(child))

    // calculate actuals after processing child nodes so that actual duration
    // takes loops into account
    this.calculateActuals(node)
    this.convertNodeType(node)
  }

  public calculateMaximums(plan: IPlan) {
    const largest = _.maxBy(this.flat, NodeProp.ACTUAL_ROWS_REVISED)
    if (largest) {
      plan.content.maxRows = largest[NodeProp.ACTUAL_ROWS_REVISED] as number
    }

    const costliest = _.maxBy(this.flat, NodeProp.EXCLUSIVE_COST)
    if (costliest) {
      plan.content.maxCost = costliest[NodeProp.EXCLUSIVE_COST] as number
    }

    const totalCostliest = _.maxBy(this.flat, NodeProp.TOTAL_COST)
    if (totalCostliest) {
      plan.content.maxTotalCost = totalCostliest[NodeProp.TOTAL_COST] as number
    }

    const slowest = _.maxBy(this.flat, NodeProp.EXCLUSIVE_DURATION)
    if (slowest) {
      plan.content.maxDuration = slowest[NodeProp.EXCLUSIVE_DURATION] as number
    }

    const highestEstimateFactor = _.max(
      _.map(this.flat, (node) => {
        const f = node[NodeProp.PLANNER_ESTIMATE_FACTOR]
        if (f !== Infinity) {
          return f
        }
      }),
    ) as number
    plan.content.maxEstimateFactor = highestEstimateFactor * 2 || 1
  }

  // actual duration and actual cost are calculated by subtracting child values from the total
  public calculateActuals(node: Node) {
    if (!_.isUndefined(node[NodeProp.ACTUAL_TOTAL_TIME])) {
      // since time is reported for an invidual loop, actual duration must be adjusted by number of loops
      // number of workers is also taken into account
      const workers = (node[NodeProp.WORKERS_LAUNCHED_BY_GATHER] || 0) + 1
      node[NodeProp.ACTUAL_TOTAL_TIME] =
        ((node[NodeProp.ACTUAL_TOTAL_TIME] as number) *
          (node[NodeProp.ACTUAL_LOOPS] as number)) /
        workers
      node[NodeProp.ACTUAL_STARTUP_TIME] =
        ((node[NodeProp.ACTUAL_STARTUP_TIME] as number) *
          (node[NodeProp.ACTUAL_LOOPS] as number)) /
        workers
      node[NodeProp.EXCLUSIVE_DURATION] = node[NodeProp.ACTUAL_TOTAL_TIME]

      const duration =
        (node[NodeProp.EXCLUSIVE_DURATION] as number) -
        this.childrenDuration(node, 0)
      node[NodeProp.EXCLUSIVE_DURATION] = duration > 0 ? duration : 0
    }

    if (!_.isUndefined(node[NodeProp.TOTAL_COST])) {
      node[NodeProp.EXCLUSIVE_COST] = node[NodeProp.TOTAL_COST]
    }

    _.each(node[NodeProp.PLANS], (subPlan) => {
      if (subPlan[NodeProp.TOTAL_COST]) {
        node[NodeProp.EXCLUSIVE_COST] =
          (node[NodeProp.EXCLUSIVE_COST] as number) -
          (subPlan[NodeProp.TOTAL_COST] as number)
      }
    })

    if ((node[NodeProp.EXCLUSIVE_COST] as number) < 0) {
      node[NodeProp.EXCLUSIVE_COST] = 0
    }

    _.each(
      [
        "ACTUAL_ROWS",
        "PLAN_ROWS",
        "ROWS_REMOVED_BY_FILTER",
        "ROWS_REMOVED_BY_JOIN_FILTER",
        "ROWS_REMOVED_BY_INDEX_RECHECK",
      ],
      (prop: keyof typeof NodeProp) => {
        if (!_.isUndefined(node[NodeProp[prop]])) {
          const revisedProp = (prop + "_REVISED") as keyof typeof NodeProp
          const loops = node[NodeProp.ACTUAL_LOOPS] || 1
          const revised = <number>node[NodeProp[prop]] * loops
          node[NodeProp[revisedProp] as unknown as keyof typeof Node] = revised
        }
      },
    )
  }

  public fixCteScansDuration(plan: IPlan) {
    // No need for fix if plan is not analyzed
    if (!plan.isAnalyze) {
      return
    }

    // Iterate over the CTEs
    _.each(plan.ctes, (cte) => {
      // Time spent in the CTE itself
      const cteDuration = cte[NodeProp.ACTUAL_TOTAL_TIME] || 0

      // Find all nodes that are "CTE Scan" for the given CTE
      const cteScans = _.filter(
        this.flat,
        (node) =>
          `CTE ${node[NodeProp.CTE_NAME]}` == cte[NodeProp.SUBPLAN_NAME],
      )

      // Sum of exclusive time for the CTE Scans
      const sumScansDuration = _.sumBy(
        cteScans,
        (node) => node[NodeProp.EXCLUSIVE_DURATION],
      )

      // Subtract exclusive time proportionally
      _.each(cteScans, (node) => {
        node[NodeProp.EXCLUSIVE_DURATION] = Math.max(
          0,
          node[NodeProp.EXCLUSIVE_DURATION] -
            (cteDuration * (node[NodeProp.ACTUAL_TOTAL_TIME] || 0)) /
              sumScansDuration,
        )
      })
    })
  }

  public fixInitPlanUsageDuration(plan: IPlan) {
    // No need for fix if plan is not analyzed
    if (!plan.isAnalyze) {
      return
    }

    const initPlans: Node[] = []
    const otherNodes: Node[] = []

    _.each(this.flat, (node) => {
      if (node[NodeProp.PARENT_RELATIONSHIP] == "InitPlan") {
        initPlans.push(node)
      } else {
        otherNodes.push(node)
      }
    })

    _.each(initPlans, (subPlan) => {
      // Get the sub plan name
      // It can be either:
      //  - InitPlan 2 (returns $1) -> $1
      //  - InitPlan 2 -> InitPlan 2
      if (!subPlan[NodeProp.SUBPLAN_NAME]) {
        return
      }
      const matches = /(InitPlan\s+[1-9]+)(?:\s+\(returns (\$[0-9]+)\))*/m.exec(
        subPlan[NodeProp.SUBPLAN_NAME],
      )
      if (!matches) {
        return
      }
      const name = matches[2] || matches[1]

      // Find all nodes that are using data from this InitPlan
      // There should be the name of the sub plan somewhere in the extra info
      _.each(otherNodes, (node) => {
        _.each(node, (value) => {
          if (typeof value != "string") {
            return
          }
          // Value for node property should contain sub plan name (with a number
          // matching exactly)
          if (value.indexOf(name) !== -1) {
            node[NodeProp.EXCLUSIVE_DURATION] -=
              subPlan[NodeProp.ACTUAL_TOTAL_TIME] || 0
            // Stop iterating for this node
            return false
          }
        })
      })
    })
  }

  // function to get the sum of actual durations of a a node children
  public childrenDuration(node: Node, duration: number) {
    _.each(node[NodeProp.PLANS], (child) => {
      // Subtract sub plans duration from this node except for InitPlans
      // (ie. CTE)
      if (
        child[NodeProp.PARENT_RELATIONSHIP] !== "InitPlan" ||
        (child[NodeProp.PARENT_RELATIONSHIP] == "InitPlan" &&
          node[NodeProp.NODE_TYPE] == "Result")
      ) {
        duration += child[NodeProp.ACTUAL_TOTAL_TIME] || 0 // Duration may not be set
      }
    })
    return duration
  }

  // figure out order of magnitude by which the planner mis-estimated how many rows would be
  // invloved in this node
  public calculatePlannerEstimate(node: Node) {
    if (
      node[NodeProp.ACTUAL_ROWS] !== undefined &&
      node[NodeProp.PLAN_ROWS] !== undefined
    ) {
      node[NodeProp.PLANNER_ESTIMATE_FACTOR] =
        node[NodeProp.ACTUAL_ROWS] / node[NodeProp.PLAN_ROWS]
      node[NodeProp.PLANNER_ESTIMATE_DIRECTION] = EstimateDirection.none

      if (node[NodeProp.ACTUAL_ROWS] > node[NodeProp.PLAN_ROWS]) {
        node[NodeProp.PLANNER_ESTIMATE_DIRECTION] = EstimateDirection.under
      }
      if (node[NodeProp.ACTUAL_ROWS] < node[NodeProp.PLAN_ROWS]) {
        node[NodeProp.PLANNER_ESTIMATE_DIRECTION] = EstimateDirection.over
        node[NodeProp.PLANNER_ESTIMATE_FACTOR] =
          node[NodeProp.PLAN_ROWS] / node[NodeProp.ACTUAL_ROWS]
      }
    }
  }

  public calculateSearchString(node: Node) {
    const fieldsToCheck = [
      NodeProp.NODE_TYPE,
      NodeProp.RELATION_NAME,
      NodeProp.ALIAS,
      NodeProp.INDEX_NAME,
      NodeProp.CTE_NAME,
      NodeProp.FUNCTION_NAME,
      NodeProp.FILTER,
      NodeProp.JOIN_TYPE,
      NodeProp.HASH_CONDITION,
      NodeProp.GROUP_KEY,
      NodeProp.SORT_KEY,
    ]

    node[NodeProp.SEARCH_STRING] = fieldsToCheck
      .map((field) => {
        const val = node[field]
        if (typeof val === "string") {
          return val
        } else if (Array.isArray(val)) {
          return val.filter((v) => typeof v === "string").join(" ")
        }
        return ""
      })
      .join(" ")
      .toLowerCase()
  }

  public fromSource(source: string) {
    return this.parser.parse(source)
  }

  public async fromSourceAsync(source: string): Promise<IPlanContent> {
    if (typeof Worker !== "undefined") {
      try {
        const module = await import("@/workers/parser.worker?worker")
        const ParserWorker = module.default
        if (!ParserWorker) {
          throw new Error(
            "Worker default export not found (likely in test environment)",
          )
        }
        return await new Promise((resolve, reject) => {
          const worker = new ParserWorker()
          worker.onmessage = (event) => {
            resolve(event.data)
            worker.terminate()
          }
          worker.onerror = (error) => {
            reject(error)
            worker.terminate()
          }
          worker.postMessage(source)
        })
      } catch (e) {
        console.warn("Worker failed, falling back to synchronous parsing", e)
        return this.fromSource(source)
      }
    } else {
      return Promise.resolve(this.fromSource(source))
    }
  }

  private findOutputProperty(node: Node): boolean {
    // resursively look for an "Output" property
    const children = node.Plans
    if (!children) {
      return false
    }
    return _.some(children, (child) => {
      return _.has(child, NodeProp.OUTPUT) || this.findOutputProperty(child)
    })
  }

  private convertNodeType(node: Node): void {
    // Convert some node type (possibly from JSON source) to match the TEXT format
    if (node[NodeProp.NODE_TYPE] == "Aggregate" && node[NodeProp.STRATEGY]) {
      let prefix = ""
      switch (node[NodeProp.STRATEGY]) {
        case "Sorted":
          prefix = "Group"
          break
        case "Hashed":
          prefix = "Hash"
          break
        case "Plain":
          prefix = ""
          break
        default:
          console.error("Unsupported Aggregate Strategy")
      }
      node[NodeProp.NODE_TYPE] = prefix + "Aggregate"
    }

    if (node[NodeProp.NODE_TYPE] == "ModifyTable") {
      node[NodeProp.NODE_TYPE] = node[NodeProp.OPERATION] as string
    }
  }
}
