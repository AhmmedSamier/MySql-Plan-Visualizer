import LZString from "lz-string"
import type { Plan } from "@/../example/src/types"

export async function compressPlanToUrl(plan: Plan): Promise<string> {
  const data = JSON.stringify(plan)
  let compressed: string

  if (typeof Worker !== "undefined") {
    try {
      const module = await import("@/workers/compression.worker?worker")
      const CompressionWorker = module.default
      if (!CompressionWorker) {
        throw new Error(
          "Worker default export not found (likely in test environment)",
        )
      }
      compressed = await new Promise<string>((resolve, reject) => {
        const worker = new CompressionWorker()
        worker.onmessage = (event) => {
          if (event.data.error) {
            reject(new Error(event.data.error))
          } else {
            resolve(event.data.result)
          }
          worker.terminate()
        }
        worker.onerror = (error) => {
          reject(error)
          worker.terminate()
        }
        worker.postMessage(data)
      })
    } catch (e) {
      console.warn("Worker compression failed, falling back to synchronous", e)
      compressed = LZString.compressToEncodedURIComponent(data)
    }
  } else {
    compressed = LZString.compressToEncodedURIComponent(data)
  }

  const base = import.meta.env.BASE_URL || "/"

  if (base.endsWith(".html")) {
    return window.location.origin + base + "#plan=" + compressed
  }

  // Ensure consistent handling of trailing slash
  const normalizedBase = base.endsWith("/") ? base : base + "/"

  return window.location.origin + normalizedBase + "plan#plan=" + compressed
}

export function decompressPlanFromUrl(urlHash: string): Plan | null {
  try {
    const matches = urlHash.match(/#plan=(.+)$/)
    if (matches && matches[1]) {
      const decompressed = LZString.decompressFromEncodedURIComponent(
        matches[1],
      )
      if (decompressed) {
        return JSON.parse(decompressed) as Plan
      }
    }
  } catch (e) {
    console.error("Failed to decompress plan", e)
  }
  return null
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error("Failed to copy!", err)
    return false
  }
}
