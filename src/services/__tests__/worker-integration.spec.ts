import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import { NodeProp } from "@/enums"

describe("PlanService Worker Integration", () => {
  test("can parse using fromSourceAsync", async () => {
    const warn = console.warn
    console.warn = () => {}
    try {
      const planService = new PlanService()
      const source = "-> Result  (cost=0.00 rows=0)"
      const result = await planService.fromSourceAsync(source)
      expect(result.Plan).toBeDefined()
      expect(result.Plan[NodeProp.NODE_TYPE]).toBe("Result")
    } finally {
      console.warn = warn
    }
  })
})
