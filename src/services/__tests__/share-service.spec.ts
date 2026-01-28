import { describe, it, expect, vi, afterEach } from "vitest"
import { compressPlanToUrl } from "../share-service"
import type { IPlan, IPlanContent } from "@/interfaces"

// Polyfill window for environments where it is not defined (e.g. bun test without jsdom)
if (typeof window === "undefined") {
  global.window = {
    location: {
      origin: "http://localhost",
      pathname: "/",
    } as Location,
  } as Window & typeof globalThis
}

describe("share-service", () => {
  const originalLocation = window.location

  afterEach(() => {
    vi.unstubAllEnvs()
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: originalLocation,
    })
  })

  const setupBase = (base: string) => {
    vi.stubEnv("BASE_URL", base)
  }

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

  const plan: [string, string, string, string] = [
    "name",
    "source",
    "query",
    new Date().toISOString(),
  ]

  it("handles root path", () => {
    setupBase("/")
    setupLocation("/")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/plan#plan=")
  })

  it("handles subdirectory path", () => {
    setupBase("/subdir/")
    setupLocation("/subdir/")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("handles subdirectory path without trailing slash", () => {
    setupBase("/subdir")
    setupLocation("/subdir")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("handles index.html path", () => {
    setupBase("/dist/index.html")
    setupLocation("/dist/index.html")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/dist/index.html#plan=")
  })

  it("strips path from root", () => {
    setupBase("/")
    setupLocation("/plan/123")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/plan#plan=")
  })

  it("strips path from subdirectory", () => {
    setupBase("/subdir/")
    setupLocation("/subdir/plan/123")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("strips /compare route", () => {
    setupBase("/subdir/")
    setupLocation("/subdir/compare/1/2")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("strips /about route", () => {
    setupBase("/subdir/")
    setupLocation("/subdir/about")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("does NOT strip partial matches like /planning", () => {
    setupBase("/planning/")
    setupLocation("/planning")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/planning/plan#plan=")
  })

  it("does NOT strip partial matches in subdirectory like /subdir/planning", () => {
    setupBase("/subdir/planning/")
    setupLocation("/subdir/planning")
    const url = compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/planning/plan#plan=")
  })
})
