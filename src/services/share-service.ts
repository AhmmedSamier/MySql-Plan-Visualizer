import LZString from "lz-string"
import type { Plan } from "@/../example/src/types"

export function compressPlanToUrl(plan: Plan): string {
  const data = JSON.stringify(plan)
  const compressed = LZString.compressToEncodedURIComponent(data)
  const base = import.meta.env.BASE_URL ?? window.location.pathname
  return (
    window.location.origin +
    base +
    (base.endsWith("/") ? "" : "/") +
    "#plan=" +
    compressed
  )
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
