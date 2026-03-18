import { argsToStr, redactSecrets, isString } from "./utils";
import { getEnvName } from "../shared/getEnvName";
import * as process from "process";

export type LogDisplayLevel = "DEBUG" | "INFO";

/**
 * Console wrapper that adds prefixes and redacts secrets from logs
 */
export class PrefixedRedactedConsole {
  globalPrefix: string = "";
  secrets: Array<string> = [];
  history: Array<string> = [];
  logDisplayLevel: LogDisplayLevel = "DEBUG";

  setGlobalPrefix(prefix: string) {
    this.globalPrefix = prefix;
  }

  initialize() {
    this.secrets = [];
    this.history = [];
  }

  addSecrets(secrets: Array<string | null>) {
    this.secrets = [
      ...this.secrets,
      ...(secrets.filter((str) => isString(str)) as string[]),
    ];
  }

  setLogDisplayLevel(level: LogDisplayLevel) {
    this.logDisplayLevel = level;
  }

  log(...params: any[]) {
    this._log({ color: "", prefix: "LOG", params, display: true });
  }

  debug(...params: any[]) {
    this._log({
      color: "\x1b[38;5;244m",
      prefix: "DEBUG",
      params,
      display: this.logDisplayLevel === "DEBUG",
    });
  }

  info(...params: any[]) {
    this._log({ color: "", prefix: "INFO", params, display: true });
  }

  warn(...params: any[]) {
    this._warn({ color: "\x1b[33m", prefix: "WARN", params, display: true });
  }

  error(...params: any[]) {
    this._warn({ color: "\x1b[31m", prefix: "ERROR", params, display: true });
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

  _redactParams(params: any[]) {
    return redactSecrets(this.secrets, argsToStr(params));
  }

  _log(props: {
    params: any[];
    color: string;
    prefix: string;
    display: boolean;
  }) {
    this._write({ ...props, stream: process.stdout });
  }

  _warn(props: {
    params: any[];
    color: string;
    prefix: string;
    display: boolean;
  }) {
    this._write({ ...props, stream: process.stderr });
  }

  _write(props: {
    params: any[];
    color: string;
    prefix: string;
    stream: typeof process.stdout | typeof process.stderr;
    display: boolean;
  }) {
    const { params, color, prefix, stream, display } = props;
    const message = `[${prefix}]: ${this._redactParams(params)}`;
    this.history.push(message);

    if (!display) return;

    let envName: string | null = null;
    try {
      envName = getEnvName();
    } catch {
      // Some command flows (notably `un dev`) intentionally set the env later.
      // Logging should never crash the process.
      envName = null;
    }

    if (envName === "dev") {
      stream.write(
        `${
          this.globalPrefix ? this.globalPrefix + " " : ""
        }${color}${message}\x1b[0m\n`
      );
      return;
    }

    stream.write(
      `${this.globalPrefix ? this.globalPrefix + " " : ""}${message}\n`
    );
  }
}
