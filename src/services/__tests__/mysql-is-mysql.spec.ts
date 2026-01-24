import { describe, expect, test } from "vitest"
import { MysqlPlanService } from "@/services/mysql-plan-service"

describe("MysqlPlanService.isMySQL", () => {
  const service = new MysqlPlanService()

  test("returns true for MySQL V1 plan (query_block)", () => {
    const data = {
      query_block: { select_id: 1 }
    }
    expect(service.isMySQL(data)).toBe(true)
  })

  test("returns true for MySQL V2 plan (query_plan)", () => {
    const data = {
      query_plan: { execution_plan: {} }
    }
    expect(service.isMySQL(data)).toBe(true)
  })

  test("returns true for MySQL V2 plan (execution_plan)", () => {
    const data = {
      execution_plan: {}
    }
    expect(service.isMySQL(data)).toBe(true)
  })

  test("returns true for generic plan with inputs (potential MySQL)", () => {
    const data = {
      inputs: []
    }
    expect(service.isMySQL(data)).toBe(true)
  })

  test("returns true for generic plan with steps (potential MySQL)", () => {
    const data = {
      steps: []
    }
    expect(service.isMySQL(data)).toBe(true)
  })

  test("returns false for Postgres plan (Plan property)", () => {
    const data = {
      Plan: { "Node Type": "Seq Scan" }
    }
    expect(service.isMySQL(data)).toBe(false)
  })

  test("returns false for empty object", () => {
    const data = {}
    expect(service.isMySQL(data)).toBe(false)
  })

  test("returns false for unrelated object", () => {
    const data = { foo: "bar" }
    expect(service.isMySQL(data)).toBe(false)
  })
})
