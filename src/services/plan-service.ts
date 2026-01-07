import _ from "lodash"
import { MysqlPlanService } from "@/services/mysql-plan-service"
import {
  EstimateDirection,
  NodeProp,
  WorkerProp,
} from "@/enums"
import type {
  IPlan,
  IPlanContent,
  IPlanStats,
} from "@/interfaces"
import { Node, Worker } from "@/interfaces"

interface NodeElement {
  node: Node
  subelementType?: string
  name?: string
}

type recurseItemType = Array<[Node, recurseItemType]>

export class PlanService {
  private nodeId = 0
  private flat: Node[] = []

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

    // Find all initPlans
    const initPlans = _.filter(
      this.flat,
      (node) => node[NodeProp.PARENT_RELATIONSHIP] == "InitPlan",
    )

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
      _.each(
        _.filter(
          this.flat,
          (node) => node[NodeProp.PARENT_RELATIONSHIP] != "InitPlan",
        ),
        (node) => {
          _.each(node, (value) => {
            if (typeof value != "string") {
              return
            }
            // Value for node property should contain sub plan name (with a number
            // matching exactly)
            const matches = new RegExp(
              `.*${name.replace(/[^a-zA-Z0-9]/g, "\\$&")}[0-9]?`,
            ).exec(value)
            if (matches) {
              node[NodeProp.EXCLUSIVE_DURATION] -=
                subPlan[NodeProp.ACTUAL_TOTAL_TIME] || 0
              // Stop iterating for this node
              return false
            }
          })
        },
      )
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

  public cleanupSource(source: string) {
    // Remove frames around, handles |, ║,
    source = source.replace(/^(\||║|│)(.*)\1\r?\n/gm, "$2\n")
    // Remove frames at the end of line, handles |, ║,
    source = source.replace(/(.*)(\||║|│)$\r?\n/gm, "$1\n")

    // Remove separator lines from various types of borders
    source = source.replace(/^\+-+\+\r?\n/gm, "")
    source = source.replace(/^(-|─|═)\1+\r?\n/gm, "")
    source = source.replace(/^(├|╟|╠|╞)(─|═)\2*(┤|╢|╣|╡)\r?\n/gm, "")

    // Remove more horizontal lines
    source = source.replace(/^\+-+\+\r?\n/gm, "")
    source = source.replace(/^└(─)+┘\r?\n/gm, "")
    source = source.replace(/^╚(═)+╝\r?\n/gm, "")
    source = source.replace(/^┌(─)+┐\r?\n/gm, "")
    source = source.replace(/^╔(═)+╗\r?\n/gm, "")

    // Remove quotes around lines, both ' and "
    source = source.replace(/^(["'])(.*)\1\r?/gm, "$2")

    // Remove "+" line continuations
    source = source.replace(/\s*\+\r?\n/g, "\n")

    // Remove "↵" line continuations
    source = source.replace(/↵\r?/gm, "\n")

    // Remove "query plan" header
    source = source.replace(/^\s*QUERY PLAN\s*\r?\n/m, "")

    // Remove rowcount
    // example: (8 rows)
    // Note: can be translated
    // example: (8 lignes)
    source = source.replace(/^\(\d+\s+[a-z]*s?\)(\r?\n|$)/gm, "\n")

    return source
  }

  public fromSource(source: string) {
    source = this.cleanupSource(source)

    try {
      const data = JSON.parse(source)
      return this.getPlanContent(data)
    } catch {
      // try to parse wrapping quotes
      const sourceTrimmed = source.trim()
      if (
        (sourceTrimmed.startsWith("'") && sourceTrimmed.endsWith("'")) ||
        (sourceTrimmed.startsWith('"') && sourceTrimmed.endsWith('"'))
      ) {
        try {
          const data = JSON.parse(
            sourceTrimmed.substring(1, sourceTrimmed.length - 1),
          )
          return this.getPlanContent(data)
        } catch {
          // ignore
        }
      }

      if (/^(\s*)(\[|\{)\s*\n.*?\1(\]|\})\s*/gms.exec(source)) {
        return this.fromJson(source)
      }
      return this.fromText(source)
    }
  }

  public fromJson(source: string) {
    // We need to remove things before and/or after explain
    // To do this, first - split explain into lines...
    const sourceLines = source.split(/[\r\n]+/)

    // Now, find first line of explain, and cache it's prefix (some spaces ...)
    let prefix = ""
    let firstLineIndex = 0
    _.each(sourceLines, (l: string, index: number) => {
      const matches = /^(\s*)(\[|\{)\s*$/.exec(l)
      if (matches) {
        prefix = matches[1]
        firstLineIndex = index
        return false
      }
    })
    // now find last line
    let lastLineIndex = 0
    _.each(sourceLines, (l: string, index: number) => {
      const matches = new RegExp("^" + prefix + "(]|})s*$").exec(l)
      if (matches) {
        lastLineIndex = index
        return false
      }
    })

    const useSource: string = sourceLines
      .slice(firstLineIndex, lastLineIndex + 1)
      .join("\n")
      // Replace two double quotes (added by pgAdmin)
      .replace(/""/gm, '"')

    const data = JSON.parse(useSource)
    return this.getPlanContent(data)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getPlanContent(value: any): IPlanContent {
    if (Array.isArray(value)) {
      value = value[0]
    }
    const mysqlService = new MysqlPlanService()
    if (mysqlService.isMySQL(value)) {
      const flat: Node[] = []
      const root = mysqlService.parseMySQL(value, flat)
      return { Plan: root } as IPlanContent
    }
    if (!value.Plan) {
      throw new Error("Invalid plan")
    }
    return value
  }

  public splitIntoLines(text: string): string[] {
    // Splits source into lines, while fixing (well, trying to fix)
    // cases where input has been force-wrapped to some length.
    const out: string[] = []
    const lines = text.split(/\r?\n/)
    const countChar = (str: string, ch: RegExp) => (str.match(ch) || []).length
    const closingFirst = (str: string) => {
      const closingParIndex = str.indexOf(")")
      const openingParIndex = str.indexOf("(")
      return closingParIndex != -1 && closingParIndex < openingParIndex
    }

    const sameIndent = (line1: string, line2: string) => {
      return line1.search(/\S/) == line2.search(/\S/)
    }

    _.each(lines, (line: string) => {
      const previousLine = out[out.length - 1]
      if (
        previousLine &&
        countChar(previousLine, /\)/g) != countChar(previousLine, /\(/g)
      ) {
        // if number of opening/closing parenthesis doesn't match in the
        // previous line, this means the current line is the continuation of previous line
        out[out.length - 1] += line
      } else if (
        line.match(
          /^(?:Total\s+runtime|Planning(\s+time)?|Execution\s+time|Time|Filter|Output|JIT|Trigger|Settings)/i,
        )
      ) {
        out.push(line)
      } else if (
        line.match(/^\S/) || // doesn't start with a blank space (allowed only for the first node)
        line.match(/^\s*\(/) || // first non-blank character is an opening parenthesis
        closingFirst(line) // closing parenthesis before opening one
      ) {
        if (0 < out.length) {
          out[out.length - 1] += line
        } else {
          out.push(line)
        }
      } else if (
        0 < out.length &&
        previousLine.match(/^.*,\s*$/) &&
        !sameIndent(previousLine, line) &&
        !line.match(/^\s*->/i)
      ) {
        // If previous line was an info line (Output, Sort Key, … with a list
        // of items separated by coma ",")
        // and current line is not same indent
        // (which would mean a new information line)
        out[out.length - 1] += line
      } else {
        out.push(line)
      }
    })
    return out
  }

  public fromText(text: string) {
    const lines = this.splitIntoLines(text)

    const root: IPlanContent = {} as IPlanContent
    type ElementAtDepth = [number, NodeElement]
    // Array to keep reference to previous nodes with there depth
    const elementsAtDepth: ElementAtDepth[] = []

    const indentationRegex = /^\s*/
    const emptyLineRegex = /^s*$/
    const headerRegex = /^\\s*(QUERY|---|#).*$/

    const prefixPattern = "^(\\s*->\\s*|\\s*)"
    const partialPattern = "(Finalize|Simple|Partial)*"
    const typePattern = "(.*?)"
    // tslint:disable-next-line:max-line-length
    // MySQL cost: (cost=10.0 rows=5)
    // We make the second cost and width optional.
    // Modified to support integer costs and scientific notation in rows/costs
    const numberPattern = "\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?"
    const estimationPattern =
      `\\(cost=(${numberPattern})(?:\\.\\.(${numberPattern}))?\\s+rows=(${numberPattern})(?:\\s+width=(\\d+))?\\)`
    const nonCapturingGroupOpen = "(?:"
    const nonCapturingGroupClose = ")"
    const openParenthesisPattern = "\\("
    const closeParenthesisPattern = "\\)"

    // MySQL actual: (actual time=0.123..4.567 rows=100 loops=1)
    const actualPattern =
      "(?:actual(?:\\stime=(\\d+(?:\\.\\d+)?)\\.\\.(\\d+(?:\\.\\d+)?))?\\srows=(\\d+(?:\\.\\d+)?)\\sloops=(\\d+)|(never\\s+executed))"
    const optionalGroup = "?"

    // tslint:disable-next-line:max-line-length
    const subRegex =
      /^(\s*)((?:Sub|Init)Plan)\s*(?:\d+\s*)?\s*(?:\(returns.*\)\s*)?$/gm

    const cteRegex = /^(\s*)CTE\s+(\S+)\s*$/g

    const triggerRegex =
      /^(\s*)Trigger\s+(.*):\s+time=(\d+\.\d+)\s+calls=(\d+)\s*$/

    enum WorkerMatch {
      Number = 2,
      ActualTimeFirst,
      ActualTimeLast,
      ActualRows,
      ActualLoops,
      NeverExecuted,
      Extra,
    }
    const workerRegex = new RegExp(
      "^(\\s*)Worker\\s+(\\d+):\\s+" +
        nonCapturingGroupOpen +
        actualPattern +
        nonCapturingGroupClose +
        optionalGroup +
        "(.*)" +
        "\\s*$",
    )

    const extraRegex = /^(\s*)(\S.*\S)\s*$/

    // We need to keep track of group indices carefully since we made some optional
    // Original groups for Cost: 1=Start, 2=Total, 3=Rows, 4=Width
    // New groups for Cost: 1=Start, 2=Total(Optional), 3=Rows, 4=Width(Optional)

    // Original groups for Actual: 1=Start, 2=Total, 3=Rows, 4=Loops, 5=Never
    // New groups for Actual: 1=Start, 2=Total, 3=Rows, 4=Loops, 5=Never

    // The nodeRegex constructs a large regex with OR branches.
    // Branch 1: Cost AND Actual
    // Branch 2: Only Cost
    // Branch 3: Only Actual

    // We must ensure the `NodeMatch` enum or logic aligns.
    // Since we can't easily change the enum which is used as array index usually,
    // let's look at how it's used. `nodeMatches` is the result of exec.
    // The code uses named constants like `NodeMatch.EstimatedStartupCost1`.

    // We DO need to update the enum because we changed the regex structure.
    // The previous enum assumed strict structure.
    // Actually, the previous code just used indices.

    enum NodeMatch {
      Prefix = 1,
      PartialMode,
      Type,
      // Branch 1 (Cost + Actual)
      EstimatedStartupCost1,
      EstimatedTotalCost1, // might be undefined if mysql
      EstimatedRows1,
      EstimatedRowWidth1, // might be undefined
      ActualTimeFirst1,
      ActualTimeLast1,
      ActualRows1,
      ActualLoops1,
      NeverExecuted1,
      // Branch 2 (Cost only)
      EstimatedStartupCost2,
      EstimatedTotalCost2,
      EstimatedRows2,
      EstimatedRowWidth2,
      // Branch 3 (Actual only)
      ActualTimeFirst2,
      ActualTimeLast2,
      ActualRows2,
      ActualLoops2,
      NeverExecuted2,
    }

    const nodeRegex = new RegExp(
      prefixPattern +
        partialPattern +
        "\\s*" +
        typePattern +
        "\\s*" +
        nonCapturingGroupOpen +
        // Option 1: Both Cost AND Actual
        (nonCapturingGroupOpen +
          estimationPattern +
          "\\s+" +
          openParenthesisPattern +
          actualPattern +
          closeParenthesisPattern +
          nonCapturingGroupClose) +
        "|" +
        // Option 2: Only Cost
        nonCapturingGroupOpen +
        estimationPattern +
        nonCapturingGroupClose +
        "|" +
        // Option 3: Only Actual
        nonCapturingGroupOpen +
        openParenthesisPattern +
        actualPattern +
        closeParenthesisPattern +
        nonCapturingGroupClose +
        nonCapturingGroupClose +
        "\\s*$",
      "m",
    )

    _.each(lines, (line: string) => {
      // Remove any trailing "
      line = line.replace(/"\s*$/, "")
      // Remove any begining "
      line = line.replace(/^\s*"/, "")
      // Replace tabs with 4 spaces
      line = line.replace(/\t/gm, "    ")

      const match = line.match(indentationRegex)
      const depth = match ? match[0].length : 0
      // remove indentation
      line = line.replace(indentationRegex, "")

      const emptyLineMatches = emptyLineRegex.exec(line)
      const headerMatches = headerRegex.exec(line)
      const nodeMatches = nodeRegex.exec(line)
      const subMatches = subRegex.exec(line)

      const cteMatches = cteRegex.exec(line)
      const triggerMatches = triggerRegex.exec(line)
      const workerMatches = workerRegex.exec(line)

      const extraMatches = extraRegex.exec(line)

      if (emptyLineMatches || headerMatches) {
        return
      } else if (nodeMatches && !cteMatches && !subMatches) {
        //const prefix = nodeMatches[NodeMatch.Prefix]
        const neverExecuted =
          nodeMatches[NodeMatch.NeverExecuted1] ||
          nodeMatches[NodeMatch.NeverExecuted2]
        const newNode: Node = new Node(nodeMatches[NodeMatch.Type])

        // Cost values from Branch 1 or Branch 2
        // Note: For MySQL, EstimatedTotalCost1/2 might be undefined if we only matched start cost.
        // We logic needs to handle that `cost=10` maps to TotalCost?
        // In regex: (cost=10) -> group1=10, group2=undefined
        // If we want `total cost` to be 10, we should put it there.
        // Usually strict PG cost=0..10.
        // If MySQL cost=10, we probably want that as Total Cost.

        const startupCost1 = nodeMatches[NodeMatch.EstimatedStartupCost1]
        const totalCost1 = nodeMatches[NodeMatch.EstimatedTotalCost1]
        const startupCost2 = nodeMatches[NodeMatch.EstimatedStartupCost2]
        const totalCost2 = nodeMatches[NodeMatch.EstimatedTotalCost2]

        if (startupCost1) {
          newNode[NodeProp.STARTUP_COST] = parseFloat(startupCost1)
          newNode[NodeProp.TOTAL_COST] = parseFloat(totalCost1 || startupCost1) // If total is missing, use start (single cost value)
        } else if (startupCost2) {
          newNode[NodeProp.STARTUP_COST] = parseFloat(startupCost2)
          newNode[NodeProp.TOTAL_COST] = parseFloat(totalCost2 || startupCost2)
        }

        if (
          nodeMatches[NodeMatch.EstimatedRows1] ||
          nodeMatches[NodeMatch.EstimatedRows2]
        ) {
          newNode[NodeProp.PLAN_ROWS] = parseInt(
            nodeMatches[NodeMatch.EstimatedRows1] ||
              nodeMatches[NodeMatch.EstimatedRows2],
            0,
          )
        }

        if (
          nodeMatches[NodeMatch.EstimatedRowWidth1] ||
          nodeMatches[NodeMatch.EstimatedRowWidth2]
        ) {
          newNode[NodeProp.PLAN_WIDTH] = parseInt(
            nodeMatches[NodeMatch.EstimatedRowWidth1] ||
              nodeMatches[NodeMatch.EstimatedRowWidth2],
            0,
          )
        }

        if (
          nodeMatches[NodeMatch.ActualTimeFirst1] ||
          nodeMatches[NodeMatch.ActualTimeFirst2]
        ) {
          newNode[NodeProp.ACTUAL_STARTUP_TIME] = parseFloat(
            nodeMatches[NodeMatch.ActualTimeFirst1] ||
              nodeMatches[NodeMatch.ActualTimeFirst2] ||
              "0",
          )
          newNode[NodeProp.ACTUAL_TOTAL_TIME] = parseFloat(
            nodeMatches[NodeMatch.ActualTimeLast1] ||
              nodeMatches[NodeMatch.ActualTimeLast2] ||
              "0",
          )
        }

        if (
          nodeMatches[NodeMatch.ActualRows1] ||
          nodeMatches[NodeMatch.ActualRows2]
        ) {
          const actual_rows =
            nodeMatches[NodeMatch.ActualRows1] ||
            nodeMatches[NodeMatch.ActualRows2]
          if (actual_rows.indexOf(".") != -1) {
            newNode[NodeProp.ACTUAL_ROWS_FRACTIONAL] = true
          }
          newNode[NodeProp.ACTUAL_ROWS] = parseFloat(actual_rows)
          newNode[NodeProp.ACTUAL_LOOPS] = parseInt(
            nodeMatches[NodeMatch.ActualLoops1] ||
              nodeMatches[NodeMatch.ActualLoops2],
            0,
          )
        }

        if (nodeMatches[NodeMatch.PartialMode]) {
          newNode[NodeProp.PARTIAL_MODE] = nodeMatches[NodeMatch.PartialMode]
        }

        if (neverExecuted) {
          newNode[NodeProp.ACTUAL_LOOPS] = 0
          newNode[NodeProp.ACTUAL_ROWS] = 0
          newNode[NodeProp.ACTUAL_TOTAL_TIME] = undefined
        }
        const element = {
          node: newNode,
          subelementType: "subnode",
        }

        if (0 === elementsAtDepth.length) {
          elementsAtDepth.push([depth, element])
          root.Plan = newNode
          return
        }

        // Remove elements from elementsAtDepth for deeper levels
        _.remove(elementsAtDepth, (e) => {
          return e[0] >= depth
        })

        // ! is for non-null assertion
        // Prevents the "Object is possibly 'undefined'" linting error
        const previousElement = _.last(elementsAtDepth)?.[1] as NodeElement

        if (!previousElement) {
          return
        }

        elementsAtDepth.push([depth, element])

        if (!previousElement.node[NodeProp.PLANS]) {
          previousElement.node[NodeProp.PLANS] = []
        }
        if (previousElement.subelementType === "initplan") {
          newNode[NodeProp.PARENT_RELATIONSHIP] = "InitPlan"
          newNode[NodeProp.SUBPLAN_NAME] = previousElement.name as string
        } else if (previousElement.subelementType === "subplan") {
          newNode[NodeProp.PARENT_RELATIONSHIP] = "SubPlan"
          newNode[NodeProp.SUBPLAN_NAME] = previousElement.name as string
        }
        previousElement.node.Plans?.push(newNode)
      } else if (subMatches) {
        //const prefix = subMatches[1]
        const type = subMatches[2]
        // Remove elements from elementsAtDepth for deeper levels
        _.remove(elementsAtDepth, (e) => e[0] >= depth)
        const previousElement = _.last(elementsAtDepth)?.[1]
        const element = {
          node: previousElement?.node as Node,
          subelementType: type.toLowerCase(),
          name: subMatches[0],
        }
        elementsAtDepth.push([depth, element])
      } else if (cteMatches) {
        //const prefix = cteMatches[1]
        const cteName = cteMatches[2]
        // Remove elements from elementsAtDepth for deeper levels
        _.remove(elementsAtDepth, (e) => e[0] >= depth)
        const previousElement = _.last(elementsAtDepth)?.[1]
        const element = {
          node: previousElement?.node as Node,
          subelementType: "initplan",
          name: "CTE " + cteName,
        }
        elementsAtDepth.push([depth, element])
      } else if (workerMatches) {
        //const prefix = workerMatches[1]
        const workerNumber = parseInt(workerMatches[WorkerMatch.Number], 0)
        const previousElement = _.last(elementsAtDepth)?.[1] as NodeElement
        if (!previousElement) {
          return
        }
        if (!previousElement.node[NodeProp.WORKERS]) {
          previousElement.node[NodeProp.WORKERS] = [] as Worker[]
        }
        let worker = this.getWorker(previousElement.node, workerNumber)
        if (!worker) {
          worker = new Worker(workerNumber)
          previousElement.node[NodeProp.WORKERS]?.push(worker)
        }
        if (
          workerMatches[WorkerMatch.ActualTimeFirst] &&
          workerMatches[WorkerMatch.ActualTimeLast]
        ) {
          worker[NodeProp.ACTUAL_STARTUP_TIME] = parseFloat(
            workerMatches[WorkerMatch.ActualTimeFirst],
          )
          worker[NodeProp.ACTUAL_TOTAL_TIME] = parseFloat(
            workerMatches[WorkerMatch.ActualTimeLast],
          )
          worker[NodeProp.ACTUAL_ROWS] = parseInt(
            workerMatches[WorkerMatch.ActualRows],
            0,
          )
          worker[NodeProp.ACTUAL_LOOPS] = parseInt(
            workerMatches[WorkerMatch.ActualLoops],
            0,
          )
        }

        // extra info
        const info = workerMatches[WorkerMatch.Extra]
          .split(/: (.+)/)
          .filter((x) => x)
        if (workerMatches[WorkerMatch.Extra]) {
          if (!info[1]) {
            return
          }
          const property = _.startCase(info[0])
          worker[property] = info[1]
        }
      } else if (triggerMatches) {
        // Remove elements from elementsAtDepth for deeper levels
        _.remove(elementsAtDepth, (e) => e[0] >= depth)
        // Ignoring triggers as they are PG specific usually
      } else if (extraMatches) {
        //const prefix = extraMatches[1]

        // Remove elements from elementsAtDepth for deeper levels
        // Depth == 1 is a special case here. Global info (for example
        // execution|planning time) have a depth of 1 but shouldn't be removed
        // in case first node was at depth 0.
        _.remove(elementsAtDepth, (e) => e[0] >= depth || depth == 1)

        let element
        if (elementsAtDepth.length === 0) {
          element = root
        } else {
          element = _.last(elementsAtDepth)?.[1].node as Node
        }

        // if no node have been found yet and a 'Query Text' has been found
        // there the line is the part of the query
        if (!element.Plan && element["Query Text"]) {
          element["Query Text"] += "\n" + line
          return
        }

        const info = extraMatches[2].split(/: (.+)/).filter((x) => x)
        if (!info[1]) {
          return
        }

        if (!element) {
          return
        }

        // remove the " ms" unit in case of time
        let value: string | number = info[1].replace(/(\s*ms)$/, "")
        // try to convert to number
        if (parseFloat(value)) {
          value = parseFloat(value)
        }

        let property = info[0]
        if (
          property.indexOf(" runtime") !== -1 ||
          property.indexOf(" time") !== -1
        ) {
          property = _.startCase(property)
        }
        element[property] = value
      }
    })
    if (root == null || !root.Plan) {
      throw new Error("Unable to parse plan")
    }
    return root
  }

  private parseTime(text: string): number {
    return parseFloat(text.replace(/(\s*ms)$/, ""))
  }

  private getWorker(node: Node, workerNumber: number): Worker | undefined {
    return _.find(node[NodeProp.WORKERS], (worker) => {
      return worker[WorkerProp.WORKER_NUMBER] === workerNumber
    })
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
