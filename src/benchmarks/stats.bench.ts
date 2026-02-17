import { bench, describe } from "vitest"
import _ from "lodash"
import { NodeProp } from "@/enums"
import { Node } from "@/interfaces"

// Mock Node class and data
const createMockNodes = (count: number) => {
  const nodes: Node[] = []
  for (let i = 0; i < count; i++) {
    const node = new Node("Seq Scan")
    node[NodeProp.EXCLUSIVE_DURATION] = Math.random() * 10
    node[NodeProp.NODE_TYPE] = ["Seq Scan", "Index Scan", "Nested Loop", "Hash Join"][i % 4]
    if (i % 2 === 0) node[NodeProp.RELATION_NAME] = `Table_${i % 10}`
    if (i % 3 === 0) node[NodeProp.FUNCTION_NAME] = `Func_${i % 5}`
    if (i % 4 === 0) node[NodeProp.INDEX_NAME] = `Index_${i % 8}`
    nodes.push(node)
  }
  return nodes
}

const nodes = createMockNodes(10000)
const executionTime = 1000

interface StatsGroupItem {
  name: string
  count: number
  time: number
  nodes: Node[]
  timePercent: number
}

describe("Stats Calculation", () => {
  bench("Original Implementation", () => {
    ;(() => {
      const tables: { [key: string]: Node[] } = _.groupBy(
        _.filter(nodes, (n) => n[NodeProp.RELATION_NAME] !== undefined),
        NodeProp.RELATION_NAME,
      )
      const values: StatsGroupItem[] = []
      _.each(tables, (nodes, tableName) => {
        const time = _.sumBy(nodes, NodeProp.EXCLUSIVE_DURATION)
        values.push({
          name: tableName,
          count: nodes.length,
          time,
          timePercent: time / executionTime,
          nodes,
        })
      })
      return values
    })()

    ;(() => {
      const functions: { [key: string]: Node[] } = _.groupBy(
        _.filter(nodes, (n) => n[NodeProp.FUNCTION_NAME] !== undefined),
        NodeProp.FUNCTION_NAME,
      )
      const values: StatsGroupItem[] = []
      _.each(functions, (nodes, functionName) => {
        const time = _.sumBy(nodes, NodeProp.EXCLUSIVE_DURATION)
        values.push({
          name: functionName,
          count: nodes.length,
          time,
          timePercent: time / executionTime,
          nodes,
        })
      })
      return values
    })()

    ;(() => {
      const nodeTypes: { [key: string]: Node[] } = _.groupBy(
        nodes,
        NodeProp.NODE_TYPE,
      )
      const values: StatsGroupItem[] = []
      _.each(nodeTypes, (nodes, nodeType) => {
        const time = _.sumBy(nodes, NodeProp.EXCLUSIVE_DURATION)
        values.push({
          name: nodeType,
          count: nodes.length,
          time,
          timePercent: time / executionTime,
          nodes,
        })
      })
      return values
    })()

    ;(() => {
      const indexes: { [key: string]: Node[] } = _.groupBy(
        _.filter(nodes, (n) => n[NodeProp.INDEX_NAME] !== undefined),
        NodeProp.INDEX_NAME,
      )
      const values: StatsGroupItem[] = []
      _.each(indexes, (nodes, indexName) => {
        const time = _.sumBy(nodes, NodeProp.EXCLUSIVE_DURATION)
        values.push({
          name: indexName,
          count: nodes.length,
          time,
          timePercent: time / executionTime,
          nodes,
        })
      })
      return values
    })()
  })

  bench("Optimized Implementation (Accumulate)", () => {
    const tables: Record<string, { nodes: Node[], time: number }> = {}
    const functions: Record<string, { nodes: Node[], time: number }> = {}
    const nodeTypes: Record<string, { nodes: Node[], time: number }> = {}
    const indexes: Record<string, { nodes: Node[], time: number }> = {}

    for (const node of nodes) {
      const duration = node[NodeProp.EXCLUSIVE_DURATION] as number

      const tableName = node[NodeProp.RELATION_NAME] as string
      if (tableName) {
        if (!tables[tableName]) tables[tableName] = { nodes: [], time: 0 }
        tables[tableName].nodes.push(node)
        tables[tableName].time += duration
      }

      const functionName = node[NodeProp.FUNCTION_NAME] as string
      if (functionName) {
        if (!functions[functionName]) functions[functionName] = { nodes: [], time: 0 }
        functions[functionName].nodes.push(node)
        functions[functionName].time += duration
      }

      const nodeType = node[NodeProp.NODE_TYPE] as string
      if (nodeType) {
        if (!nodeTypes[nodeType]) nodeTypes[nodeType] = { nodes: [], time: 0 }
        nodeTypes[nodeType].nodes.push(node)
        nodeTypes[nodeType].time += duration
      }

      const indexName = node[NodeProp.INDEX_NAME] as string
      if (indexName) {
        if (!indexes[indexName]) indexes[indexName] = { nodes: [], time: 0 }
        indexes[indexName].nodes.push(node)
        indexes[indexName].time += duration
      }
    }

    const perTable = []
    for (const tableName in tables) {
      const group = tables[tableName]
      perTable.push({
        name: tableName,
        count: group.nodes.length,
        time: group.time,
        nodes: group.nodes,
      })
    }

    const perFunction = []
    for (const functionName in functions) {
      const group = functions[functionName]
      perFunction.push({
        name: functionName,
        count: group.nodes.length,
        time: group.time,
        nodes: group.nodes,
      })
    }

    const perNodeType = []
    for (const nodeType in nodeTypes) {
      const group = nodeTypes[nodeType]
      perNodeType.push({
        name: nodeType,
        count: group.nodes.length,
        time: group.time,
        nodes: group.nodes,
      })
    }

    const perIndex = []
    for (const indexName in indexes) {
      const group = indexes[indexName]
      perIndex.push({
        name: indexName,
        count: group.nodes.length,
        time: group.time,
        nodes: group.nodes,
      })
    }
  })
})
