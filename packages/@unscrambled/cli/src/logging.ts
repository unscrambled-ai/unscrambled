import { PrefixedRedactedConsole } from "./logging/PrefixedRedactedConsole";
import { logDisplayLevel } from "./shared/setLogDisplayLevel";

export const prefixedRedactedConsole = new PrefixedRedactedConsole();

export function prepareConsole() {
  prefixedRedactedConsole.setGlobalPrefix(
    "\x1b[38;5;208m" + "CLI:" + "\x1b[0m"
  );
  prefixedRedactedConsole.setLogDisplayLevel(logDisplayLevel);

  console.log = (...args: any[]) => prefixedRedactedConsole.log(...args);
  console.debug = (...args: any[]) => prefixedRedactedConsole.debug(...args);
  console.info = (...args: any[]) => prefixedRedactedConsole.info(...args);
  console.warn = (...args: any[]) => prefixedRedactedConsole.warn(...args);
  console.error = (...args: any[]) => prefixedRedactedConsole.error(...args);
}
