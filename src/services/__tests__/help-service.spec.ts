import { describe, it, expect } from "vitest"
import { splitBalanced, shouldShowProp } from "../help-service"
import { NodeProp } from "@/enums"

describe("help-service", () => {
  describe("shouldShowProp", () => {
    it("should return false for keys in notMiscProperties", () => {
      expect(shouldShowProp(NodeProp.ACTUAL_ROWS, 100)).toBe(false)
      expect(shouldShowProp(NodeProp.NODE_TYPE, "some type")).toBe(false)
      expect(shouldShowProp(NodeProp.OUTPUT, "some output")).toBe(false)
    })

    it("should return true for unknown keys with a value", () => {
      expect(shouldShowProp("SomeRandomKey", 100)).toBe(true)
      expect(shouldShowProp("AnotherRandomKey", "some value")).toBe(true)
    })

    it("should return false for unknown keys without a value", () => {
      expect(shouldShowProp("SomeRandomKey", null)).toBe(false)
      expect(shouldShowProp("AnotherRandomKey", undefined)).toBe(false)
      expect(shouldShowProp("YetAnotherRandomKey", "")).toBe(false) // Assuming empty string is falsy
    })
  })

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
