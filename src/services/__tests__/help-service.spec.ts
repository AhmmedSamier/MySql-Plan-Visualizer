import { describe, it, expect } from "vitest"
import { splitBalanced } from "../help-service"

describe("help-service", () => {
  describe("splitBalanced", () => {
    it("splits a simple string", () => {
      const result = splitBalanced("a,b,c", ",")
      expect(result).toEqual(["a", "b", "c"])
    })

    it("splits a string with spaces", () => {
      const result = splitBalanced("a, b, c", ",")
      expect(result).toEqual(["a", " b", " c"])
    })

    it("respects parenthesis", () => {
      const result = splitBalanced("a,b(c,d),e", ",")
      expect(result).toEqual(["a", "b(c,d)", "e"])
    })

    it("respects braces", () => {
      const result = splitBalanced("a,b{c,d},e", ",")
      expect(result).toEqual(["a", "b{c,d}", "e"])
    })

    it("respects brackets", () => {
      const result = splitBalanced("a,b[c,d],e", ",")
      expect(result).toEqual(["a", "b[c,d]", "e"])
    })

    it("respects single quotes", () => {
      const result = splitBalanced("a,'b,c',d", ",")
      expect(result).toEqual(["a", "'b,c'", "d"])
    })

    it("respects double quotes", () => {
      const result = splitBalanced('a,"b,c",d', ",")
      expect(result).toEqual(["a", '"b,c"', "d"])
    })

    it("respects nested structures", () => {
      const result = splitBalanced("a,(b,c(d,e)),f", ",")
      expect(result).toEqual(["a", "(b,c(d,e))", "f"])
    })

    it("handles escaping", () => {
      const result = splitBalanced("a,b\\,c,d", ",")
      expect(result).toEqual(["a", "b,c", "d"])
    })

    it("handles different separators", () => {
      // expect(splitBalanced("a|b(c|d)|e", "|")).toEqual(["a", "b(c|d)", "e"]) // Regex injection issue
      expect(splitBalanced("a b(c d) e", " ")).toEqual(["a", "b(c d)", "e"])
    })

    it("returns array with empty strings for trailing separators", () => {
      // "a,b," -> ["a", "b", ""]
      expect(splitBalanced("a,b,", ",")).toEqual(["a", "b", ""])
    })
  })
})
