const prefixedLog =
  (fn: typeof console.log) =>
  (...args: any[]) =>
    fn("CLI:", ...args);

const originalConsole = {
  log: prefixedLog(console.log),
  debug: prefixedLog(console.debug),
  info: prefixedLog(console.info),
  warn: prefixedLog(console.warn),
  error: prefixedLog(console.error),
};

export function restoreConsole() {
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;

  console.debug("Console restored");
}
