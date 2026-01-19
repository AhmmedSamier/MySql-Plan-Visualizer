import escape from "lodash/escape"
import { EstimateDirection, nodePropTypes, PropType } from "@/enums"
import hljs from "highlight.js/lib/core"
import sql from "highlight.js/lib/languages/sql"
hljs.registerLanguage("sql", sql)

import json from "highlight.js/lib/languages/json"
hljs.registerLanguage("json", json)

export function duration(value: number | undefined): string {
  if (value === undefined) {
    return "-"
  }
  if (value < 0) {
    console.error(`
      Duration is negative. This is probably a bug.
      Please report it at https://github.com/ahmmedsamier/MySql-Plan-Visualizer.
    `)
  }
  const result: string[] = []
  let denominator: number = 1000 * 60 * 60 * 24
  const days = Math.floor(value / denominator)
  if (days) {
    result.push(days + "d")
  }
  let remainder = value % denominator
  denominator /= 24
  const hours = Math.floor(remainder / denominator)
  if (hours) {
    result.push(hours + "h")
  }
  remainder = remainder % denominator
  denominator /= 60
  const minutes = Math.floor(remainder / denominator)
  if (minutes) {
    result.push(minutes + "m")
  }
  remainder = remainder % denominator
  denominator /= 60
  const seconds = Math.floor(remainder / denominator)
  if (seconds) {
    result.push(seconds + "s")
  }
  remainder = remainder % denominator
  const milliseconds = parseFloat(remainder.toPrecision(3))
  result.push(milliseconds.toLocaleString() + "ms")

  return result.slice(0, 2).join(" ")
}

export function cost(value: number | undefined): string {
  if (value === undefined) {
    return "N/A"
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
}

export function rows(value: number | undefined): string {
  if (value === undefined) {
    return "N/A"
  }
  return value.toLocaleString()
}

export function loops(value: number | undefined): string {
  if (value === undefined) {
    return "N/A"
  }
  return value.toLocaleString()
}

export function factor(value: number): string {
  const f: string = parseFloat(value.toPrecision(2)).toLocaleString()
  return `${f}&nbsp;&times;`
}

export function keysToString(value: string[] | string): string {
  if (!(value instanceof Array)) {
    value = [value]
  }
  value = value.map((v) => escape(v.replace(/(^\(|\)$)/g, "")))
  return value.join(", ")
}

export function sortKeys(
  sort: string[],
  presort: string[] | undefined,
): string {
  return sort
    .map((v) => {
      let result = escape(v)
      if (presort) {
        result +=
          presort.indexOf(v) !== -1
            ? '&nbsp;<span class="text-secondary">(presort)</span>'
            : ""
      }
      return result
    })
    .join(", ")
}

export function truncate(text: string, length: number, clamp: string): string {
  clamp = clamp || "..."
  return text.length > length ? text.slice(0, length) + clamp : text
}

export function kilobytes(value: number): string {
  return formatBytes(value * 1024)
}

export function bytes(value: number): string {
  return formatBytes(value)
}

export function formatBytes(value: number, precision = 2) {
  const k = 1024
  const dm = precision < 0 ? 0 : precision
  const units = ["Bytes", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const i = Math.floor(Math.log(value) / Math.log(k))
  const valueString = parseFloat(
    (value / Math.pow(k, i)).toPrecision(dm),
  ).toLocaleString()
  return `${valueString}\u00A0${units[i]}`
}

export function blocksAsBytes(value: number): string {
  return value ? formatBytes(value * 8 * 1024) : ""
}

export function blocks(value: number, asHtml = false): string {
  asHtml = !!asHtml
  if (!value) {
    return ""
  }
  let r = value.toLocaleString()
  if (asHtml) {
    r += `<br><small>${blocksAsBytes(value)}</small>`
  }
  return r
}

export function percent(value: number): string {
  if (isNaN(value)) {
    return "-"
  }
  return Math.round(value * 100) + "%"
}

export function list(value: string[] | string): string {
  if (typeof value === "string") {
    value = value.split(/\s*,\s*/)
  }
  const lines = value.map((line) => `<li>${line}</li>`).join("")
  return '<ul class="list-unstyled mb-0">' + lines + "</ul>"
}

export function transferRate(value: number): string {
  if (!value) {
    return ""
  }
  return blocksAsBytes(value) + "/s"
}

export function formatNodeProp(key: string, value: unknown): string {
  if (Object.prototype.hasOwnProperty.call(nodePropTypes, key)) {
    if (nodePropTypes[key] === PropType.duration) {
      return duration(value as number)
    } else if (nodePropTypes[key] === PropType.boolean) {
      return value ? "yes" : "no"
    } else if (nodePropTypes[key] === PropType.cost) {
      return cost(value as number)
    } else if (nodePropTypes[key] === PropType.rows) {
      return rows(value as number)
    } else if (nodePropTypes[key] === PropType.loops) {
      return loops(value as number)
    } else if (nodePropTypes[key] === PropType.factor) {
      return factor(value as number)
    } else if (nodePropTypes[key] === PropType.estimateDirection) {
      switch (value) {
        case EstimateDirection.over:
          return '<i class="fa fa-arrow-up"></i> over'
        case EstimateDirection.under:
          return '<i class="fa fa-arrow-down"></i> under'
        default:
          return "-"
      }
    } else if (nodePropTypes[key] === PropType.json) {
      return JSON.stringify(value, null, 2)
    } else if (nodePropTypes[key] === PropType.bytes) {
      return bytes(value as number)
    } else if (nodePropTypes[key] === PropType.kilobytes) {
      return kilobytes(value as number)
    } else if (nodePropTypes[key] === PropType.blocks) {
      return blocks(value as number, true)
    } else if (nodePropTypes[key] === PropType.list) {
      return list(value as string[])
    } else if (nodePropTypes[key] === PropType.transferRate) {
      return transferRate(value as number)
    }
  }
  return escape(value as unknown as string)
}

export function durationClass(i: number): string {
  let c
  if (i > 90) {
    c = 4
  } else if (i > 40) {
    c = 3
  } else if (i > 10) {
    c = 2
  }
  if (c) {
    return "c-" + c
  }
  return ""
}

export function mysql_(text: string) {
  return hljs.highlight(text, { language: "sql" }).value
}

export function json_(text: string) {
  return hljs.highlight(text, { language: "json" }).value
}
