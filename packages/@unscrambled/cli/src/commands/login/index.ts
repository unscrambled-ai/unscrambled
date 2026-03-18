import { Command, Option } from "commander";
import { prompt } from "enquirer";
import startServer from "./startServer";
import getRequestHandler from "./getRequestHandler";
import openBrowser from "./openBrowser";
import getAccountType from "./getAccountType";
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
    .action(async (options) => {
      let authUrl = "https://app.runlightyear.com";
      let baseUrl = "https://app.runlightyear.com";
      if (options.dev) {
        terminal.red("In dev mode, using http://localhost:3000\n");
        authUrl = "http://localhost:3000";
        baseUrl = "http://localhost:3000";
      }

      const accountType = name === "login" ? "existing" : "new";

      const localPort = await startServer(getRequestHandler(baseUrl));

      await openBrowser(authUrl, baseUrl, accountType, localPort);
    });
}
