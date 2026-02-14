import { describe, expect, test } from "vitest"
import { getWorkersLaunchedCount } from "../node"
import { NodeProp } from "../enums"
import { Node } from "../interfaces"

describe("getWorkersLaunchedCount", () => {
  test("returns count for array of workers", () => {
    const node = new Node("Seq Scan")
    // @ts-expect-error testing invalid type
    node[NodeProp.WORKERS] = [{}, {}]
    expect(getWorkersLaunchedCount(node)).toBe(2)
  })

  test("returns count for number of workers", () => {
    const node = new Node("Seq Scan")
    // @ts-expect-error testing invalid type
    node[NodeProp.WORKERS] = 3
    expect(getWorkersLaunchedCount(node)).toBe(3)
  })

  test("returns NaN for undefined workers", () => {
    const node = new Node("Seq Scan")
    expect(getWorkersLaunchedCount(node)).toBeNaN()
  })

  test("returns NaN for object workers", () => {
    const node = new Node("Seq Scan")
    // @ts-expect-error testing invalid type
    node[NodeProp.WORKERS] = { count: 3 }
    expect(getWorkersLaunchedCount(node)).toBeNaN()
  })

  test("prioritizes WORKERS_LAUNCHED", () => {
    const node = new Node("Seq Scan")
    node[NodeProp.WORKERS_LAUNCHED] = 5
    // @ts-expect-error testing invalid type
    node[NodeProp.WORKERS] = 3
    expect(getWorkersLaunchedCount(node)).toBe(5)
  })

  test("prioritizes WORKERS_LAUNCHED_BY_GATHER", () => {
    const node = new Node("Seq Scan")
    node[NodeProp.WORKERS_LAUNCHED_BY_GATHER] = 4
    // @ts-expect-error testing invalid type
    node[NodeProp.WORKERS] = 3
    expect(getWorkersLaunchedCount(node)).toBe(4)
  })

  test("prioritizes WORKERS_LAUNCHED over WORKERS_LAUNCHED_BY_GATHER", () => {
    const node = new Node("Seq Scan")
    node[NodeProp.WORKERS_LAUNCHED] = 5
    node[NodeProp.WORKERS_LAUNCHED_BY_GATHER] = 4
    expect(getWorkersLaunchedCount(node)).toBe(5)
  })
})
