import { Command, Option } from "commander";
import startServer from "./startServer";
import getRequestHandler from "./getRequestHandler";
import openBrowser from "./openBrowser";
import { terminal } from "terminal-kit";

export const login = new Command("login");
export const signup = new Command("signup");

const obj: { [name: string]: Command } = { login: login, signup: signup };

for (const name in obj) {
  obj[name]
    .description(
      `${name === "login" ? "Log in" : "Sign up"} to get credentials`
    )
    .addOption(new Option("--dev").hideHelp())
    .addOption(
      new Option("-o, --output <format>", "Output format")
        .choices(["text", "json"])
        .default("text")
    )
    .addHelpText(
      "after",
      `
Examples:
  unscrambled ${name}
  unscrambled ${name} --output json
`
    )
    .action(async (options: { dev?: boolean; output: "text" | "json" }) => {
      let authUrl = "https://app.unscrambled.ai";
      let baseUrl = "https://app.unscrambled.ai";
      if (options.dev) {
        if (options.output !== "json") {
          terminal.red("In dev mode, using http://localhost:3000\n");
        }
        authUrl = "http://localhost:3000";
        baseUrl = "http://localhost:3000";
      }

      const accountType = name === "login" ? "existing" : "new";
      process.env.UNSCRAMBLED_CLI_OUTPUT_FORMAT = options.output;

      const localPort = await startServer(getRequestHandler(baseUrl));

      await openBrowser(authUrl, baseUrl, accountType, localPort, {
        quiet: options.output === "json",
      });
    });
}
