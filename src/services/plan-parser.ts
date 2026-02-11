import startCase from "lodash/startCase"
import { MysqlPlanService } from "@/services/mysql-plan-service"
import { NodeProp, WorkerProp } from "@/enums"
import type { IPlanContent } from "@/interfaces"
import { Node, Worker } from "@/interfaces"

interface NodeElement {
  node: Node
  subelementType?: string
  name?: string
}

enum WorkerMatch {
  Number = 2,
  ActualTimeFirst,
  ActualTimeLast,
  ActualRows,
  ActualLoops,
  NeverExecuted,
  Extra,
}

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
const estimationPattern = `\\(cost=(${numberPattern})(?:\\.\\.(${numberPattern}))?\\s+rows=(${numberPattern})(?:\\s+width=(\\d+))?\\)`
const nonCapturingGroupOpen = "(?:"
const nonCapturingGroupClose = ")"
const openParenthesisPattern = "\\("
const closeParenthesisPattern = "\\)"

// MySQL actual: (actual time=0.123..4.567 rows=100 loops=1)
const actualPattern =
  "(?:actual(?:\\stime=(\\d+(?:\\.\\d+)?)\\.\\.(\\d+(?:\\.\\d+)?))?\\srows=(\\d+(?:\\.\\d+)?)\\sloops=(\\d+)|(never\\s+executed))"
const optionalGroup = "?"

const triggerRegex = /^(\s*)Trigger\s+(.*):\s+time=(\d+\.\d+)\s+calls=(\d+)\s*$/

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

export class PlanParser {
  public parse(source: string): IPlanContent {
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
    source = source.replace(/^\(\d+\s+[^)]+\)(\r?\n|$)/gm, "\n")

    return source
  }

  public fromJson(source: string) {
    // We need to remove things before and/or after explain
    // To do this, first - split explain into lines...
    const sourceLines = source.split(/[\r\n]+/)

    // Now, find first line of explain, and cache it's prefix (some spaces ...)
    let prefix = ""
    let firstLineIndex = 0
    for (let index = 0; index < sourceLines.length; index++) {
      const l = sourceLines[index]
      const matches = /^(\s*)(\[|\{)\s*$/.exec(l)
      if (matches) {
        prefix = matches[1]
        firstLineIndex = index
        break
      }
    }
    // now find last line
    let lastLineIndex = 0
    for (let index = 0; index < sourceLines.length; index++) {
      const l = sourceLines[index]
      const matches = new RegExp("^" + prefix + "(]|})s*$").exec(l)
      if (matches) {
        lastLineIndex = index
        break
      }
    }

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
      // Return a plan content that preserves top-level metadata
      return { ...value, Plan: root } as IPlanContent
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
    const getBalance = (str: string) => {
      let balance = 0
      let posOpen = str.indexOf("(")
      let posClose = str.indexOf(")")
      while (posOpen !== -1 || posClose !== -1) {
        if (posOpen !== -1 && (posClose === -1 || posOpen < posClose)) {
          balance++
          posOpen = str.indexOf("(", posOpen + 1)
        } else {
          balance--
          posClose = str.indexOf(")", posClose + 1)
        }
      }
      return balance
    }
    const closingFirst = (str: string) => {
      const closingParIndex = str.indexOf(")")
      const openingParIndex = str.indexOf("(")
      return closingParIndex != -1 && closingParIndex < openingParIndex
    }

    const sameIndent = (line1: string, line2: string) => {
      return line1.search(/\S/) == line2.search(/\S/)
    }

    let currentBalance = 0
    lines.forEach((line: string) => {
      const lineBalance = getBalance(line)
      const previousLine = out[out.length - 1]
      if (previousLine && currentBalance !== 0) {
        // if number of opening/closing parenthesis doesn't match in the
        // previous line, this means the current line is the continuation of previous line
        out[out.length - 1] += line
        currentBalance += lineBalance
      } else if (
        line.match(
          /^(?:Total\s+runtime|Planning(\s+time)?|Execution\s+time|Time|Filter|Output|JIT|Trigger|Settings)/i,
        )
      ) {
        out.push(line)
        currentBalance = lineBalance
      } else if (
        line.match(/^\S/) || // doesn't start with a blank space (allowed only for the first node)
        line.match(/^\s*\(/) || // first non-blank character is an opening parenthesis
        closingFirst(line) // closing parenthesis before opening one
      ) {
        if (0 < out.length) {
          out[out.length - 1] += line
          currentBalance += lineBalance
        } else {
          out.push(line)
          currentBalance = lineBalance
        }
      } else if (
        0 < out.length &&
        previousLine.trimEnd().endsWith(",") &&
        !sameIndent(previousLine, line) &&
        !line.match(/^\s*->/i)
      ) {
        // If previous line was an info line (Output, Sort Key, … with a list
        // of items separated by coma ",")
        // and current line is not same indent
        // (which would mean a new information line)
        out[out.length - 1] += line
        currentBalance += lineBalance
      } else {
        out.push(line)
        currentBalance = lineBalance
      }
    })
    return out
  }

  public fromText(text: string) {
    const lines = this.splitIntoLines(text)

    const root: IPlanContent = {} as IPlanContent
    type ElementAtDepth = [number, NodeElement]
    // Array to keep reference to previous nodes with there depth
    let elementsAtDepth: ElementAtDepth[] = []

    // tslint:disable-next-line:max-line-length
    const subRegex =
      /^(\s*)((?:Sub|Init)Plan)\s*(?:\d+\s*)?\s*(?:\(returns.*\)\s*)?$/gm

    const cteRegex = /^(\s*)CTE\s+(\S+)\s*$/g

    lines.forEach((line: string) => {
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
        // Note: For MySQL, a single cost value (e.g. `cost=10`) is captured as EstimatedStartupCost.
        // The logic below ensures that if only one cost is present, it is assigned to Total Cost.

        const startupCost1 = nodeMatches[NodeMatch.EstimatedStartupCost1]
        const totalCost1 = nodeMatches[NodeMatch.EstimatedTotalCost1]
        const startupCost2 = nodeMatches[NodeMatch.EstimatedStartupCost2]
        const totalCost2 = nodeMatches[NodeMatch.EstimatedTotalCost2]

        if (startupCost1) {
          if (totalCost1) {
            newNode[NodeProp.STARTUP_COST] = parseFloat(startupCost1)
            newNode[NodeProp.TOTAL_COST] = parseFloat(totalCost1)
          } else {
            newNode[NodeProp.TOTAL_COST] = parseFloat(startupCost1)
          }
        } else if (startupCost2) {
          if (totalCost2) {
            newNode[NodeProp.STARTUP_COST] = parseFloat(startupCost2)
            newNode[NodeProp.TOTAL_COST] = parseFloat(totalCost2)
          } else {
            newNode[NodeProp.TOTAL_COST] = parseFloat(startupCost2)
          }
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
        elementsAtDepth = elementsAtDepth.filter((e) => !(e[0] >= depth))

        // ! is for non-null assertion
        // Prevents the "Object is possibly 'undefined'" linting error
        const previousElement = elementsAtDepth[
          elementsAtDepth.length - 1
        ]?.[1] as NodeElement

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
        elementsAtDepth = elementsAtDepth.filter((e) => !(e[0] >= depth))
        const previousElement = elementsAtDepth[elementsAtDepth.length - 1]?.[1]
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
        elementsAtDepth = elementsAtDepth.filter((e) => !(e[0] >= depth))
        const previousElement = elementsAtDepth[elementsAtDepth.length - 1]?.[1]
        const element = {
          node: previousElement?.node as Node,
          subelementType: "initplan",
          name: "CTE " + cteName,
        }
        elementsAtDepth.push([depth, element])
      } else if (workerMatches) {
        //const prefix = workerMatches[1]
        const workerNumber = parseInt(workerMatches[WorkerMatch.Number], 0)
        const previousElement = elementsAtDepth[
          elementsAtDepth.length - 1
        ]?.[1] as NodeElement
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
          const property = startCase(info[0])
          worker[property] = info[1]
        }
      } else if (triggerMatches) {
        // Remove elements from elementsAtDepth for deeper levels
        elementsAtDepth = elementsAtDepth.filter((e) => !(e[0] >= depth))
        // Ignoring triggers as they are PG specific usually
      } else if (extraMatches) {
        //const prefix = extraMatches[1]

        // Remove elements from elementsAtDepth for deeper levels
        // Depth == 1 is a special case here. Global info (for example
        // execution|planning time) have a depth of 1 but shouldn't be removed
        // in case first node was at depth 0.
        elementsAtDepth = elementsAtDepth.filter(
          (e) => !(e[0] >= depth || depth == 1),
        )

        let element
        if (elementsAtDepth.length === 0) {
          element = root
        } else {
          element = elementsAtDepth[elementsAtDepth.length - 1]?.[1]
            .node as Node
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
          property = startCase(property)
        }
        element[property] = value
      }
    })
    if (root == null || !root.Plan) {
      throw new Error("Unable to parse plan")
    }
    return root
  }

  private getWorker(node: Node, workerNumber: number): Worker | undefined {
    return node[NodeProp.WORKERS]?.find((worker) => {
      return worker[WorkerProp.WORKER_NUMBER] === workerNumber
    })
  }
}
