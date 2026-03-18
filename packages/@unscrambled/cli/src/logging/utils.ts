export function isString(val: any): boolean {
  return typeof val === "string";
}

export function isObject(val: any): boolean {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function isArray(val: any): boolean {
  return Array.isArray(val);
}

export function argsToStr(args: Array<any>): string {
  return args
    .map((arg) => {
      if (isString(arg)) {
        return arg;
      }

      if (arg instanceof Error) {
        // Build a comprehensive error string
        const parts: string[] = [];

        // Add name and message
        if (arg.name) {
          parts.push(arg.name);
        }
        if (arg.message) {
          parts.push(arg.message);
        }

        // If we got nothing useful, try to stringify
        if (parts.length === 0) {
          parts.push(String(arg));
        }

        // Add stack if available and not already included
        if (arg.stack && !parts.some((p) => p.includes(arg.stack!))) {
          parts.push(arg.stack);
        }

        return parts.join(": ");
      }

      if (isObject(arg) || isArray(arg)) {
        let result: string;

        try {
          result = JSON.stringify(arg, null, 2);
          // If it's an empty object or empty array, be more explicit
          if (result === "{}") {
            return "[Empty Object]";
          }
          if (result === "[]") {
            return "[Empty Array]";
          }
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

export function redactSecrets(
  secrets: Array<string | null>,
  str: string
): string {
  let newStr = str;

  secrets.forEach((secret) => {
    if (secret) {
      newStr = newStr.replace(secret, `*****${secret.slice(-3)}`);
    }
  });

  return newStr;
}
