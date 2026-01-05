import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import type { IPlanContent } from "@/interfaces"
import { NodeProp } from "@/enums"

describe("PlanService MySQL JSON V1", () => {
  test("can parse MySQL JSON V1 plan with nested_loop", () => {
    const planService = new PlanService()
    const source = JSON.stringify({
      query_block: {
        select_id: 1,
        cost_info: {
          query_cost: "250.00",
        },
        nested_loop: [
          {
            table: {
              table_name: "users",
              access_type: "ALL",
              rows_examined_per_scan: 1000,
              filtered: "100.00",
              cost_info: {
                read_cost: "50.00",
                eval_cost: "10.00",
                prefix_cost: "60.00",
                data_read_per_join: "1M",
              },
              used_columns: ["id", "name"],
            },
          },
          {
            table: {
              table_name: "orders",
              access_type: "ref",
              possible_keys: ["user_id_idx"],
              key: "user_id_idx",
              used_key_parts: ["user_id"],
              key_length: "4",
              ref: ["test_db.users.id"],
              rows_examined_per_scan: 5,
              filtered: "50.00",
              cost_info: {
                read_cost: "20.00",
                eval_cost: "5.00",
                prefix_cost: "150.00",
                data_read_per_join: "500K",
              },
            },
          },
          {
            table: {
              table_name: "details",
              access_type: "eq_ref",
              key: "PRIMARY",
              rows_examined_per_scan: 1,
              filtered: "100.00",
              cost_info: {
                read_cost: "5.00",
                eval_cost: "1.00",
                prefix_cost: "250.00",
                data_read_per_join: "10K",
              },
            },
          },
        ],
      },
    })

    const r = planService.fromSource(source) as IPlanContent
    const plan = r.Plan

    // Verify Root
    // The parser converts [A, B, C] nested loop into (A JOIN B) JOIN C
    // So root should be "Nested Loops"
    expect(plan[NodeProp.NODE_TYPE]).toBe("Nested Loops")

    // Total cost of query
    // The parser logic for costs sums children if present, or takes from wrapper?
    // In V1 parse logic:
    // if (data.cost_info) node[NodeProp.TOTAL_COST] = parseFloat(data.cost_info.query_cost)
    // The root `query_block` has cost_info.
    // However, the `nested_loop` array handling creates a chain.
    // Let's trace:
    // parseV1(query_block) calls nested_loop map.
    // children = [Table(users), Table(orders), Table(details)]
    // Loop 1: joinNode(users, orders). current = joinNode
    // Loop 2: joinNode(prevJoin, details). current = joinNode
    // Returns current.
    // Wait, the outer `query_block` cost info is applied to `node` at the end of `parseV1`.
    // So the final root node (the top join) gets the total query cost.
    expect(plan[NodeProp.TOTAL_COST]).toBe(250.00)

    // Verify Structure: Left-Deep Tree
    // Root -> Plans[0] (Join A+B), Plans[1] (Table C)
    const children = plan[NodeProp.PLANS]
    expect(children).toHaveLength(2)

    const leftJoin = children[0] // Join (Users + Orders)
    const tableC = children[1]   // Details

    expect(leftJoin[NodeProp.NODE_TYPE]).toBe("Nested Loops")
    expect(tableC[NodeProp.RELATION_NAME]).toBe("details")
    expect(tableC[NodeProp.NODE_TYPE]).toBe("Unique Key Lookup") // eq_ref map
    expect(tableC[NodeProp.PLAN_ROWS]).toBe(1)

    // Check Left Join children
    const leftChildren = leftJoin[NodeProp.PLANS]
    expect(leftChildren).toHaveLength(2)
    const tableA = leftChildren[0] // Users
    const tableB = leftChildren[1] // Orders

    expect(tableA[NodeProp.RELATION_NAME]).toBe("users")
    expect(tableA[NodeProp.NODE_TYPE]).toBe("Full Table Scan") // ALL map
    expect(tableA[NodeProp.PLAN_ROWS]).toBe(1000)
    // Cost calculation: eval + read
    // Users: 50 + 10 = 60
    expect(tableA[NodeProp.TOTAL_COST]).toBe(60.00)

    expect(tableB[NodeProp.RELATION_NAME]).toBe("orders")
    expect(tableB[NodeProp.NODE_TYPE]).toBe("Index Scan") // ref map
    expect(tableB[NodeProp.PLAN_ROWS]).toBe(5)
  })

  test("can parse MySQL JSON V1 plan with ordering and grouping", () => {
    const planService = new PlanService()
    const source = JSON.stringify({
      query_block: {
        select_id: 1,
        ordering_operation: {
          using_filesort: true,
          grouping_operation: {
            using_temporary_table: true,
            table: {
              table_name: "t1",
              access_type: "ALL",
              rows_examined_per_scan: 500,
              cost_info: {
                read_cost: "10.00",
                eval_cost: "5.00"
              }
            }
          }
        }
      }
    })

    const r = planService.fromSource(source) as IPlanContent
    const plan = r.Plan

    // Structure: Sort -> Aggregate -> Table
    expect(plan[NodeProp.NODE_TYPE]).toBe("Sort")

    const sortChild = plan[NodeProp.PLANS][0]
    expect(sortChild[NodeProp.NODE_TYPE]).toBe("Aggregate")

    const aggChild = sortChild[NodeProp.PLANS][0]
    expect(aggChild[NodeProp.RELATION_NAME]).toBe("t1")
    expect(aggChild[NodeProp.NODE_TYPE]).toBe("Full Table Scan")
    expect(aggChild[NodeProp.TOTAL_COST]).toBe(15.00)
  })
})
