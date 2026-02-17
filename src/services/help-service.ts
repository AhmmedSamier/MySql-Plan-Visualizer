import _ from "lodash"
import type { IPlan, Node } from "@/interfaces"
import { NodeProp } from "@/enums"
import { nodePropTypes, PropType } from "@/enums"

export class HelpService {
  public nodeId = 0

  public getNodeTypeDescription(nodeType: string) {
    if (!nodeType) {
      return undefined
    }
    const upperNodeType = nodeType.toUpperCase()
    // try exact match first
    if (NODE_DESCRIPTIONS[upperNodeType]) {
      return NODE_DESCRIPTIONS[upperNodeType]
    }
    // try to find a key that is contained in the node type
    const key = Object.keys(NODE_DESCRIPTIONS).find((k) =>
      upperNodeType.includes(k),
    )
    if (key) {
      return NODE_DESCRIPTIONS[key]
    }
    return undefined
  }

  public getHelpMessage(helpMessage: string) {
    return HELP_MESSAGES[helpMessage.toUpperCase()]
  }
}

interface INodeDescription {
  [key: string]: string
}

export const NODE_DESCRIPTIONS: INodeDescription = {
  LIMIT: "returns a specified number of rows from a record set.",
  SORT: "sorts a record set based on the specified sort key.",
  "NESTED LOOPS":
    "joins two tables by taking each row from the first table and searching for matching rows in the second table.",
  "NESTED LOOP": `merges two record sets by looping through every record in the first set and
   trying to find a match in the second set. All matching records are returned.`,
  "MERGE JOIN": `merges two record sets by first sorting them on a <strong>join key</strong>.`,
  HASH: `generates a hash table from the records in the input recordset. Hash is used by
   <strong>Hash Join</strong>.`,
  "HASH JOIN": `joins two record sets by hashing one of them (using a <strong>Hash Scan</strong>).`,
  AGGREGATE: `groups records together based on a GROUP BY or aggregate function (like <code>sum()</code>).`,
  HASHAGGREGATE: `groups records together based on a GROUP BY or aggregate function (like sum()). Hash Aggregate uses
   a hash to first organize the records by a key.`,
  "SEQ SCAN": `finds relevant records by sequentially scanning the input record set. When reading from a table,
   Seq Scans (unlike Index Scans) perform a single read operation (only the table is read).`,
  "INDEX SCAN": `finds relevant records based on an <strong>Index</strong>.
    Index Scans perform 2 read operations: one to
    read the index and another to read the actual value from the table.`,
  "INDEX ONLY SCAN": `finds relevant records based on an <strong>Index</strong>.
    Index Only Scans perform a single read operation
    from the index and do not read from the corresponding table.`,
  "BITMAP HEAP SCAN": `searches through the pages returned by the <strong>Bitmap Index Scan</strong>
    for relevant rows.`,
  "BITMAP INDEX SCAN": `uses a <strong>Bitmap Index</strong> (index which uses 1 bit per page)
    to find all relevant pages.
    Results of this node are fed to the <strong>Bitmap Heap Scan</strong>.`,
  "CTE SCAN": `performs a sequential scan of <strong>Common Table Expression (CTE) query</strong> results. Note that
    results of a CTE are materialized (calculated and temporarily stored).`,
  MEMOIZE: `is used to cache the results of the inner side of a nested loop. It avoids executing underlying nodes when the results for the current parameters are already in the cache.`,
  GATHER: `reads the results of the parallel workers, in an undefined order.`,
  "GATHER MERGE": `reads the results of the parallel workers, preserving any ordering.`,
  // MySQL specific
  "TABLE SCAN":
    "MySQL reads every row in the table, usually because no useful index can be used or a full scan is cheaper than using an index.",
  "FULL TABLE SCAN":
    "Same as Table Scan: the optimizer reads the whole table, which is often expensive for large tables.",
  "FULL INDEX SCAN":
    "MySQL reads the entire index. Often used to avoid an extra sort when the index order matches ORDER BY, or when the index is covering.",
  "INDEX LOOKUP":
    "MySQL looks up rows through an index for specific key values, fetching matching table rows as needed.",
  "INDEX RANGE SCAN":
    "MySQL reads only the part of an index that matches a range condition (for example BETWEEN, >, <, IN), then fetches matching rows from the table.",
  "UNIQUE KEY LOOKUP":
    "MySQL uses a unique index or PRIMARY KEY to find at most one row for each lookup value. This is one of the most efficient access types.",
  "CONSTANT LOOKUP":
    "The table has at most one matching row, which is read once at the beginning of the query and treated as a constant.",
  SYSTEM:
    "A special case of Constant Lookup where the table contains a single row. Access cost is effectively negligible.",
  "FULL TEXT SCAN":
    "MySQL evaluates a MATCH ... AGAINST condition using a FULLTEXT index instead of scanning all rows.",
  "INDEX MERGE":
    "MySQL uses several indexes on the same table and merges the index results (UNION or INTERSECT) to determine the final row set.",
  "UNIQUE SUBQUERY":
    "Optimization for IN subqueries that can use a unique index, turning the subquery into efficient single-row index lookups.",
  "INDEX SUBQUERY":
    "Similar to Unique Subquery, but uses a non-unique index, potentially returning multiple rows per lookup.",
  DISTINCT:
    "Removes duplicate rows from the result set. In MySQL JSON plans this usually corresponds to a duplicates_removal or DISTINCT step.",
  FILTER:
    "Applies a condition to each row and discards rows that do not satisfy it. Often corresponds to WHERE, ON, or HAVING predicates.",
  MATERIALIZE:
    "Stores the output of a subquery or derived table in an internal temporary structure so it can be scanned multiple times efficiently.",
  FILESORT:
    "MySQL sorts rows using its filesort algorithm when ORDER BY cannot be satisfied by an index. Large sorts may spill to disk.",
  "TEMPORARY TABLE":
    "MySQL creates an internal temporary table (in memory or on disk) to hold intermediate results for operations such as GROUP BY, DISTINCT, or complex ORDER BY.",
  RESULT:
    "Represents the final result set of the query or subquery that is returned to the client or consumed by an outer query.",
}

interface IHelpMessage {
  [key: string]: string
}

export const HELP_MESSAGES: IHelpMessage = {
  "MISSING EXECUTION TIME": `Execution time (or Total runtime) not available for this plan. Make sure you
    use EXPLAIN ANALYZE.`,
  "WORKERS PLANNED NOT LAUNCHED": `Less workers than planned were launched.
Consider modifying max_parallel_workers or max_parallel_workers_per_gather.`,
  "WORKERS DETAILED INFO MISSING": `Consider using EXPLAIN (ANALYZE, VERBOSE)`,
  "FUZZY NEEDS VERBOSE": `Information may not be accurate. Use EXPLAIN VERBOSE mode.`,
  "HINT TRACK_IO_TIMING": `HINT: activate <em><b>track_io_timing</b></em> to have details on time spent outside the PG cache.`,
  "IO TIMINGS PARALLEL": "Distributed among parallel workers",
}

interface EaseInOutQuadOptions {
  currentTime: number
  start: number
  change: number
  duration: number
}

export function scrollChildIntoParentView(
  parent: Element,
  child: Element,
  shouldCenter: boolean,
  done?: () => void,
) {
  if (!child) {
    return
  }
  // Where is the parent on page
  const parentRect = parent.getBoundingClientRect()
  // Where is the child
  const childRect = child.getBoundingClientRect()

  let scrollLeft = parent.scrollLeft // don't move
  const isChildViewableX =
    childRect.left >= parentRect.left &&
    childRect.left <= parentRect.right &&
    childRect.right <= parentRect.right

  let scrollTop = parent.scrollTop
  const isChildViewableY =
    childRect.top >= parentRect.top &&
    childRect.top <= parentRect.bottom &&
    childRect.bottom <= parentRect.bottom

  if (shouldCenter || !isChildViewableX || !isChildViewableY) {
    // scroll by offset relative to parent
    // try to put the child in the middle of parent horizontaly
    scrollLeft =
      childRect.left +
      parent.scrollLeft -
      parentRect.left -
      parentRect.width / 2 +
      childRect.width / 2
    scrollTop =
      childRect.top +
      parent.scrollTop -
      parentRect.top -
      parentRect.height / 2 +
      childRect.height / 2
    smoothScroll({
      element: parent,
      to: { scrollTop, scrollLeft },
      duration: 400,
      done,
    })
  } else if (done) {
    done()
  }
}

const easeInOutQuad = ({
  currentTime,
  start,
  change,
  duration,
}: EaseInOutQuadOptions) => {
  let newCurrentTime = currentTime
  newCurrentTime /= duration / 2

  if (newCurrentTime < 1) {
    return (change / 2) * newCurrentTime * newCurrentTime + start
  }

  newCurrentTime -= 1
  return (-change / 2) * (newCurrentTime * (newCurrentTime - 2) - 1) + start
}

interface SmoothScrollOptions {
  duration: number
  element: Element
  to: {
    scrollTop: number
    scrollLeft: number
  }
  done?: () => void
}

export function smoothScroll({
  duration,
  element,
  to,
  done,
}: SmoothScrollOptions) {
  const startX = element.scrollTop
  const startY = element.scrollLeft
  const changeX = to.scrollTop - startX
  const changeY = to.scrollLeft - startY
  const startDate = new Date().getTime()

  const animateScroll = () => {
    const currentDate = new Date().getTime()
    const currentTime = currentDate - startDate
    element.scrollTop = easeInOutQuad({
      currentTime,
      start: startX,
      change: changeX,
      duration,
    })
    element.scrollLeft = easeInOutQuad({
      currentTime,
      start: startY,
      change: changeY,
      duration,
    })

    if (currentTime < duration) {
      requestAnimationFrame(animateScroll)
    } else {
      element.scrollTop = to.scrollTop
      element.scrollLeft = to.scrollLeft
      if (done) {
        done()
      }
    }
  }
  animateScroll()
}

const splitBalancedRegexCache = new Map<string, RegExp>()

/*
 * Split a string, ensuring balanced parenthesis and balanced quotes.
 */
export function splitBalanced(input: string, split: string) {
  let r = splitBalancedRegexCache.get(split)
  if (!r) {
    // Build the pattern from params with defaults:
    const pattern = "([\\s\\S]*?)(e)?(?:(o)|(c)|(t)|(sp)|$)"
      .replace("sp", split)
      .replace("o", "[\\(\\{\\[]")
      .replace("c", "[\\)\\}\\]]")
      .replace("t", "['\"]")
      .replace("e", "[\\\\]")
    r = new RegExp(pattern, "gi")
    splitBalancedRegexCache.set(split, r)
  }
  r.lastIndex = 0

  const stack: string[] = []
  let buffer: string[] = []
  const results: string[] = []
  input.replace(r, ($0, $1, $e, $o, $c, $t, $s) => {
    if ($e) {
      // Escape
      buffer.push($1, $s || $o || $c || $t)
      return ""
    } else if ($o) {
      // Open
      stack.push($o)
    } else if ($c) {
      // Close
      stack.pop()
    } else if ($t) {
      // Toggle
      if (stack[stack.length - 1] !== $t) {
        stack.push($t)
      } else {
        stack.pop()
      }
    } else {
      // Split (if no stack) or EOF
      if ($s ? !stack.length : !$1) {
        buffer.push($1)
        results.push(buffer.join(""))
        buffer = []
        return ""
      }
    }
    buffer.push($0)
    return ""
  })
  return results
}

export function findNodeById(plan: IPlan, id: number): Node | undefined {
  let o: Node | undefined = undefined
  const root = plan.content.Plan
  if (root.nodeId == id) {
    return root
  }
  if (root && root.Plans) {
    root.Plans.some(function iter(child: Node): boolean | undefined {
      if (child.nodeId === id) {
        o = child
        return true
      }
      return child.Plans && child.Plans.some(iter)
    })
    if (!o && plan.ctes) {
      _.each(plan.ctes, (cte) => {
        if (cte.nodeId == id) {
          o = cte
          return false
        } else if (cte.Plans) {
          cte.Plans.some(function iter(child: Node): boolean | undefined {
            if (child.nodeId === id) {
              o = child
              return true
            }
            return child.Plans && child.Plans.some(iter)
          })
          if (o) {
            return false
          }
        }
      })
    }
  }
  return o
}

export function findNodeBySubplanName(
  plan: IPlan,
  subplanName: string,
): Node | undefined {
  let o: Node | undefined = undefined
  if (plan.ctes) {
    _.each(plan.ctes, (cte) => {
      if (cte[NodeProp.SUBPLAN_NAME] == "CTE " + subplanName) {
        o = cte
        return false
      }
    })
  }
  return o
}

// Returns the list of properties that have already been displayed either in
// the main panel or in other detailed tabs.
const notMiscProperties: string[] = [
  NodeProp.NODE_TYPE,
  NodeProp.CTE_NAME,
  NodeProp.EXCLUSIVE_DURATION,
  NodeProp.EXCLUSIVE_COST,
  NodeProp.TOTAL_COST,
  NodeProp.PLAN_ROWS,
  NodeProp.ACTUAL_ROWS,
  NodeProp.ACTUAL_LOOPS,
  NodeProp.OUTPUT,
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
  NodeProp.HASH_CONDITION,
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
  "size", // Manually added to use FlexTree
  NodeProp.RELATION_NAME,
  NodeProp.ALIAS,
  NodeProp.FUNCTION_NAME,
  NodeProp.STRATEGY,
  NodeProp.PARTIAL_MODE,
  NodeProp.SCAN_DIRECTION,
  NodeProp.ACTUAL_ROWS_FRACTIONAL,
]

export function shouldShowProp(key: string, value: unknown): boolean {
  return (
    (!!value ||
      nodePropTypes[key] === PropType.increment ||
      key === NodeProp.ACTUAL_ROWS) &&
    notMiscProperties.indexOf(key) === -1
  )
}
