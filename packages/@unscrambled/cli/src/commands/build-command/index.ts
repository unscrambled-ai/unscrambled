import { Command, Option, program } from "commander";
import { execBuild } from "../../shared/execBuild";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import { writeJson } from "../../shared/commandUtils";

export const build = new Command("build");

build
  .description("Build the project")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .addHelpText(
    "after",
    `
Examples:
  unscrambled build
  unscrambled build --output json
`
  )
  .action(async (options: { output: "text" | "json" }) => {
    const globalOptions = program.opts();
    if (globalOptions.debug) {
      setLogDisplayLevel("DEBUG");
      prepareConsole();
      console.debug("Outputting debug information");
    }

    await execBuild({ quiet: options.output === "json" });
    if (options.output === "json") {
      writeJson({ status: "SUCCEEDED" });
    }
  });
