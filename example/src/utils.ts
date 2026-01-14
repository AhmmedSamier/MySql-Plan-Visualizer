export function time_ago(time: string | number | Date): string | number | Date {
  let timestamp: number

  if (typeof time === "number") {
    timestamp = time
  } else if (typeof time === "string") {
    timestamp = +new Date(time)
  } else if (time instanceof Date) {
    timestamp = time.getTime()
  } else {
    timestamp = +new Date()
  }

  const time_formats: [number, string, string | number][] = [
    [60, "less than 1 minute ago", ""], // 60
    [120, "1 minute ago", "1 minute from now"], // 60*2
    [3600, "minutes", 60], // 60*60, 60
    [7200, "1 hour ago", "1 hour from now"], // 60*60*2
    [86400, "hours", 3600], // 60*60*24, 60*60
    [172800, "Yesterday", "Tomorrow"], // 60*60*24*2
    [604800, "days", 86400], // 60*60*24*7, 60*60*24
    [1209600, "Last week", "Next week"], // 60*60*24*7*4*2
    [2419200, "weeks", 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, "Last month", "Next month"], // 60*60*24*7*4*2
    [29030400, "months", 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, "Last year", "Next year"], // 60*60*24*7*4*12*2
    [2903040000, "years", 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
  ]

  let seconds = (+new Date() - timestamp) / 1000
  let token = "ago"
  let list_choice = 1

  if (seconds == 0) {
    return "Just now"
  }
  if (seconds < 0) {
    seconds = Math.abs(seconds)
    token = "from now"
    list_choice = 2
  }

  for (const format of time_formats) {
    if (seconds < format[0]) {
      if (typeof format[2] === "string") {
        return format[list_choice] as string
      } else {
        return (
          Math.floor(seconds / (format[2] as number)) +
          " " +
          format[1] +
          " " +
          token
        )
      }
    }
  }
  return time
}

export * from "../../src/services/share-service"
