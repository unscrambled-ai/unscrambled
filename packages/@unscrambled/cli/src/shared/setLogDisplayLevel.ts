export let logDisplayLevel: "DEBUG" | "INFO" = "INFO";

export function setLogDisplayLevel(level: "DEBUG" | "INFO") {
  logDisplayLevel = level;
}
