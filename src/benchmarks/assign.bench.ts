import { bench, describe } from "vitest"
import _ from "lodash"
import { reactive } from "vue"

// Simulate the data structure
class HighlightType {
  public static NONE = "none"
  public static DURATION = "duration"
  public static ROWS = "rows"
  public static COST = "cost"
}

enum Orientation {
  LeftToRight = "LeftToRight",
  TopToBottom = "TopToBottom",
}

const defaultOptions = {
  showHighlightBar: false,
  showPlanStats: true,
  highlightType: HighlightType.NONE,
  diagramWidth: 20,
  orientation: Orientation.TopToBottom,
  showDiagram: true,
}

// Simulate saved options (subset of options)
const savedOptionsStr = JSON.stringify({
  showHighlightBar: true,
  highlightType: HighlightType.DURATION,
  diagramWidth: 30,
})

describe("Object Assignment", () => {
  bench("lodash.assignIn", () => {
    const viewOptions = reactive({ ...defaultOptions })
    const saved = JSON.parse(savedOptionsStr)
    _.assignIn(viewOptions, saved)
  })

  bench("Object.assign", () => {
    const viewOptions = reactive({ ...defaultOptions })
    const saved = JSON.parse(savedOptionsStr)
    Object.assign(viewOptions, saved)
  })
})
