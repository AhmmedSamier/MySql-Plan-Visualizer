import { bench, describe } from "vitest"
import { PlanParser } from "@/services/plan-parser"

const parser = new PlanParser()

// Generate a plan with many workers and repeated access
const workerCount = 100
let source =
  "->  Parallel Seq Scan on t1  (cost=0.00..10.00 rows=100 width=4)\n"
for (let i = 0; i < workerCount; i++) {
  // Add multiple lines for the same worker to trigger getWorker multiple times
  source += `      Worker ${i}: actual time=0.01..0.02 rows=1 loops=1\n`
  source += `      Worker ${i}: JIT:\n`
  source += `      Worker ${i}:   Functions: 1\n`
  source += `      Worker ${i}:   Options: Inlining true, Optimization true, Expressions true, Deforming true\n`
  source += `      Worker ${i}:   Timing: Generation 0.001 ms, Inlining 0.001 ms, Optimization 0.001 ms, Emission 0.001 ms, Total 0.004 ms\n`
}

describe("Worker Lookup Performance", () => {
  bench("Parse Plan with Many Workers", () => {
    parser.parse(source)
  })
})
