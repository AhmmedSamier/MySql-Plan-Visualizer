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

  it("constructs URL with correct base", () => {
    // Mock window.location
    // Note: window.location is read-only in some environments, but in JSDOM we can redefine it
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: {
        origin: "http://test.com",
        pathname: "/current/path", // This should be ignored if BASE_URL is set (usually / in tests)
      },
    })

    const plan: any = ["name", "source", "query"]
    const url = compressPlanToUrl(plan)

    console.log("Generated URL:", url)

    expect(url).toContain("http://test.com")
    expect(url).toContain("#plan=")

    // Check if it ignores pathname when BASE_URL is present (assuming BASE_URL is /)
    if (import.meta.env.BASE_URL === "/") {
      expect(url).not.toContain("/current/path")
      expect(url).toContain("http://test.com/#plan=")
    } else if (import.meta.env.BASE_URL) {
      // If BASE_URL is set to something else in test config
      expect(url).toContain(import.meta.env.BASE_URL)
    } else {
      // Fallback to pathname
      expect(url).toContain("/current/path")
    }
  })
})
