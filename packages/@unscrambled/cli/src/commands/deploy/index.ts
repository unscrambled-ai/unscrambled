import { Command, Option, program } from "commander";
import deployToProd from "./deployToProd";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import { requireAuth } from "../../shared/requireAuth";
import { writeJson } from "../../shared/commandUtils";

export const deploy = new Command("deploy");

deploy
  .description("Deploy the integrations to an env (only prod for now)")
  .argument("<env>", "Environment (only 'prod' for now)")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .addHelpText(
    "after",
    `
Examples:
  unscrambled deploy prod
  unscrambled deploy prod --debug
  unscrambled deploy prod --output json
`
  )
  .action(async (env, commandOptions: { output: "text" | "json" }) => {
    requireAuth();

    const options = program.opts();
    if (options.debug) {
      setLogDisplayLevel("DEBUG");
      prepareConsole();
      console.debug("Outputting debug information");
    }

    // if (env === "dev") {
    //   await deployToDev();
    // } else if (env === "prod") {
    if (env === "prod") {
      const result = await deployToProd({
        quiet: commandOptions.output === "json",
        emitLogs: commandOptions.output !== "json",
      });
      if (commandOptions.output === "json") {
        writeJson(result);
      }
    } else {
      program.error(`Unknown env: ${env}. Should be 'prod'.`);
    }
  });
