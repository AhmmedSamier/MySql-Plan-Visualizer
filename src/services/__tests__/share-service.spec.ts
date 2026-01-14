import { describe, it, expect, vi, afterEach } from "vitest"
import { compressPlanToUrl } from "../share-service"

describe("share-service", () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: originalLocation,
    })
  })

  const setupLocation = (pathname: string) => {
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: {
        origin: "http://test.com",
        pathname: pathname,
      },
    })
  }

  const plan: any = ["name", "source", "query"]

  it("handles root path", () => {
    setupLocation("/")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/#plan=")
  })

  it("handles subdirectory path", () => {
    setupLocation("/subdir/")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/#plan=")
  })

  it("handles subdirectory path without trailing slash", () => {
    setupLocation("/subdir")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/#plan=")
  })

  it("handles index.html path", () => {
    setupLocation("/dist/index.html")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/dist/index.html#plan=")
  })

  it("strips /plan route from root", () => {
    setupLocation("/plan/123")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/#plan=")
  })

  it("strips /plan route from subdirectory", () => {
    setupLocation("/subdir/plan/123")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/#plan=")
  })

  it("strips /compare route", () => {
    setupLocation("/subdir/compare/1/2")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/#plan=")
  })

  it("strips /about route", () => {
    setupLocation("/subdir/about")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/#plan=")
  })

  it("does NOT strip partial matches like /planning", () => {
    setupLocation("/planning")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/planning/#plan=")
  })

  it("does NOT strip partial matches in subdirectory like /subdir/planning", () => {
    setupLocation("/subdir/planning")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/planning/#plan=")
  })
})
