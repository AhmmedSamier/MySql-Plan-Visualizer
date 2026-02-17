import LZString from "lz-string"

addEventListener("message", (event: MessageEvent<string>) => {
  try {
    const compressed = LZString.compressToEncodedURIComponent(event.data)
    postMessage({ result: compressed })
  } catch (error) {
    postMessage({ error: (error as Error).message })
  }
})
