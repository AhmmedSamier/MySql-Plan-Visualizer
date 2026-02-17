import { describe, it, expect, afterEach } from "vitest"
import { compressPlanToUrl } from "../share-service"

// Polyfill window for environments where it is not defined (e.g. bun test without jsdom)
if (typeof window === "undefined") {
  ;(globalThis as any).window = {
    location: {
      origin: "http://localhost",
      pathname: "/",
    } as Location,
  } as Window & typeof globalThis
}

const env = import.meta as unknown as {
  env?: {
    BASE_URL?: string
    [key: string]: string | undefined
  }
}

const originalBaseUrl = env.env?.BASE_URL

describe("share-service", () => {
  const originalLocation = window.location

  afterEach(() => {
    if (!env.env) {
      env.env = {}
    }
    env.env.BASE_URL = originalBaseUrl
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: originalLocation,
    })
  })

  const setupBase = (base: string) => {
    if (!env.env) {
      env.env = {}
    }
    env.env.BASE_URL = base
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

  it("handles root path", async () => {
    setupBase("/")
    setupLocation("/")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/plan#plan=")
  })

  it("handles subdirectory path", async () => {
    setupBase("/subdir/")
    setupLocation("/subdir/")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("handles subdirectory path without trailing slash", async () => {
    setupBase("/subdir")
    setupLocation("/subdir")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("handles index.html path", async () => {
    setupBase("/dist/index.html")
    setupLocation("/dist/index.html")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/dist/index.html#plan=")
  })

  it("strips path from root", async () => {
    setupBase("/")
    setupLocation("/plan/123")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/plan#plan=")
  })

  it("strips path from subdirectory", async () => {
    setupBase("/subdir/")
    setupLocation("/subdir/plan/123")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("strips /compare route", async () => {
    setupBase("/subdir/")
    setupLocation("/subdir/compare/1/2")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("strips /about route", async () => {
    setupBase("/subdir/")
    setupLocation("/subdir/about")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/plan#plan=")
  })

  it("does NOT strip partial matches like /planning", async () => {
    setupBase("/planning/")
    setupLocation("/planning")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/planning/plan#plan=")
  })

  it("does NOT strip partial matches in subdirectory like /subdir/planning", async () => {
    setupBase("/subdir/planning/")
    setupLocation("/subdir/planning")
    const url = await compressPlanToUrl(plan)
    expect(url).toContain("http://test.com/subdir/planning/plan#plan=")
  })
})
