import { Command } from "commander";

export function isArray(val: any) {
  return Array.isArray(val);
}

export function isObject(val: any) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function argsToStr(args: Array<any>) {
  return args
    .map((arg) => {
      if (isString(arg)) {
        return arg;
      }

      if (arg instanceof Error) {
        return String(arg);
      }

      if (isObject(arg)) {
        let result: string;

        try {
          result = JSON.stringify(arg, null, 2);
        } catch (error) {
          // just use best effort if there is recursion
          result = String(arg);
        }
        return result;
      }

      return String(arg);
    })
    .join(" ");
}

function isString(val: any) {
  return typeof val === "string";
}

function redactStr(secrets: Array<string | null>, str: string) {
  let newStr = str;

  secrets.forEach((secret) => {
    if (secret) {
      newStr = newStr.replace(secret, `*****${secret.slice(-3)}`);
    }
  });

  return newStr;
}

export class PrefixedRedactedConsole extends console.Console {
  secrets: Array<string> = [];
  history: Array<string> = [];

  addSecrets(secrets: Array<string>) {
    this.secrets = [...this.secrets, ...secrets];
  }
  redactParams(params: any[]) {
    return redactStr(this.secrets, argsToStr(params));
  }
  log(...params: any[]) {
    this._log("[LOG]", ...params);
  }

  debug(...params: any[]) {
    this._log("[DEBUG]", ...params);
  }

  info(...params: any[]) {
    this._log("[DEBUG]", ...params);
  }

  warn(...params: any[]) {
    this._warn("[WARN]", ...params);
  }

  error(...params: any[]) {
    this._warn("[ERROR]", ...params);
  }

  _log(...params: any[]) {
    const message = this.redactParams(params);
    this.history.push(message);
    super.log(message);
  }

  _warn(...params: any[]) {
    const message = this.redactParams(params);
    this.history.push(message);
    super.warn(message);
  }

  dir(...params: any[]) {
    this.error(
      "console.dir not supported. Objects are pretty-printed if possible by console.log, .debug, .info, .warn, and .error"
    );
  }
  dirxml(...params: any[]) {
    this.error("console.dirxml not supported.");
  }
  group(...params: any[]) {
    this.error("console.group not supported.");
  }
  groupCollapsed(...params: any[]) {
    this.error("console.groupCollapsed not supported.");
  }
  groupEnd(...params: any[]) {
    this.error("console.groupEnd not supported.");
  }
  table(...params: any[]) {
    this.error("console.table not supported.");
  }
}

export const test = new Command("test");

test.description("Test some things").action(async () => {
  console.log("ready to test");
  console.error("error");
  console.debug("debug");
  console.info("info");
  console.warn("warn");

  console.log("\n------\n");

  const myConsole = new PrefixedRedactedConsole({
    stdout: process.stdout,
    stderr: process.stderr,
    inspectOptions: {
      depth: 20,
    },
  });

  myConsole.log("next thing to test");
  myConsole.log("ready to test there");

  myConsole.addSecrets(["there"]);

  myConsole.error("error");
  myConsole.debug("debug");
  myConsole.info("info is there");
  myConsole.warn("warn");
  myConsole.warn(new Error("an error on a warning"));
  myConsole.error(new Error("an error"));

  myConsole.log({ hi: "there" });
  myConsole.log("An object:", { hi: "there" });
  myConsole.time();
  myConsole.timeEnd();

  const obj = {
    hi: "there",
    level1: { level2: { level3: { level4: { also: "hi" } } } },
  };

  myConsole.log(obj);
  myConsole.dir(obj, { depth: 3 });
  myConsole.log(JSON.stringify(obj, null, 2));

  console.log(myConsole.history);

  const myConsole2 = new PrefixedRedactedConsole({
    stdout: process.stdout,
    stderr: process.stderr,
    inspectOptions: {
      depth: 20,
    },
  });

  myConsole2.addSecrets(["hi"]);
  myConsole2.info("hi there");

  console.log(myConsole2.history);
});
