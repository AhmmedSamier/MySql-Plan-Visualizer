import { bench, describe } from "vitest"
import { PlanService } from "@/services/plan-service"

const planService = new PlanService()
const source = `
-> Limit: 10 row(s)  (cost=1500.00 rows=10) (actual time=50.000..50.005 rows=10 loops=1)
    -> Sort: t1.col1, t2.col2, limit input to 10 row(s)  (cost=1500.00 rows=100) (actual time=50.000..50.002 rows=10 loops=1)
        -> Stream results  (cost=1000.00 rows=100) (actual time=0.500..45.000 rows=100 loops=1)
            -> Nested loop inner join  (cost=1000.00 rows=100) (actual time=0.500..40.000 rows=100 loops=1)
                -> Filter: (t1.col1 > 50)  (cost=100.00 rows=50) (actual time=0.100..5.000 rows=50 loops=1)
                    -> Table scan on t1  (cost=100.00 rows=1000) (actual time=0.050..4.000 rows=1000 loops=1)
                -> Index lookup on t2 using idx_col1 (col1=t1.col1)  (cost=10.00 rows=2) (actual time=0.010..0.500 rows=2 loops=50)
`

describe("Plan Parsing", () => {
  bench("Synchronous", () => {
    planService.fromSource(source)
  })

  bench("Asynchronous", async () => {
    await planService.fromSourceAsync(source)
  })
})
