import { bench, describe } from "vitest"
import { compressPlanToUrl } from "../services/share-service"
import { samples } from "../../example/src/samples"

// Mock window and env
if (typeof window === "undefined") {
  global.window = {
    location: {
      origin: "http://localhost",
      href: "http://localhost/",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// Create a large plan by repeating samples
const largePlanSource = samples[5][1].repeat(1000)
const largePlan: [string, string, string, string] = [
  "Large Plan",
  largePlanSource,
  samples[5][2],
  new Date().toISOString(),
]

describe("Compression Performance", () => {
  bench("compressPlanToUrl", async () => {
    await compressPlanToUrl(largePlan)
  })
})
