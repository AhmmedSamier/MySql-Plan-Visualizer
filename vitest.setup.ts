import { vi } from "vitest"

vi.mock("@/workers/parser.worker?worker", async () => {
  const { PlanParser } = await import("@/services/plan-parser")
  return {
    default: class ParserWorker {
      public onmessage: ((event: MessageEvent) => void) | null = null
      public onerror: ((error: ErrorEvent) => void) | null = null
      private parser = new PlanParser()

      postMessage(source: string) {
        setTimeout(() => {
          try {
            const result = this.parser.parse(source)
            if (this.onmessage) {
              this.onmessage({ data: result } as MessageEvent)
            }
          } catch (e) {
            if (this.onerror) {
              this.onerror(e as unknown as ErrorEvent)
            }
          }
        }, 0)
      }

      terminate() {
        // Mock implementation
      }
    },
  }
})