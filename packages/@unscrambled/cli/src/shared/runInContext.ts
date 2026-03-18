import vm from "vm";
import { program } from "commander";

interface OurContext {
  exports: {
    handler?: (options: any) => any;
    getDeployList?: () => any;
  };
  [name: string]: unknown;
}

export default function runInContext(code: any) {
  const context: OurContext = {
    exports: {},
    require,
    URL,
    URLSearchParams,
    TextDecoder,
    global,
    console,
    process,
    fetch,
    Buffer,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(context);

  const script = new vm.Script(code.toString());

  try {
    script.runInContext(context);
  } catch (error) {
    // Extract error information before it crosses the VM boundary
    // VM errors lose their properties when they cross contexts
    const errorMessage =
      error instanceof Error ? error.message || String(error) : String(error);
    const errorStack =
      error instanceof Error && error.stack ? error.stack : undefined;
    const errorName =
      error instanceof Error && error.name ? error.name : "Error";

    // Create a new error in the main context with the extracted information
    const mainContextError = new Error(errorMessage);
    mainContextError.name = errorName;
    if (errorStack) {
      mainContextError.stack = errorStack;
    }

    throw mainContextError;
  }

  if (!context.exports.handler) {
    program.error("Can't find export 'handler'");
  }

  // return context.exports.getDeployList;
  return {
    handler: context.exports.handler,
    getDeployList: context.exports.getDeployList,
  };
}
