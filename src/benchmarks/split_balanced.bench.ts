import { bench, describe } from "vitest"
import { splitBalanced } from "../services/help-service"

describe("splitBalanced", () => {
  const input = "a,b(c,d),e,'f,g',h"
  const split = ","

  bench("splitBalanced simple", () => {
    splitBalanced(input, split)
  })

  const longInput = "a,b(c,d),e,'f,g',h".repeat(100)
  bench("splitBalanced long input", () => {
    splitBalanced(longInput, split)
  })
})
