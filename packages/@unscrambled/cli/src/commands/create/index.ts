import { Command, Option, program } from "commander";
import checkLocalDirectoryAvailable from "./checkLocalDirectoryAvailable";
import checkGitInstalled from "./checkGitInstalled";
import cloneFromTemplate from "./cloneFromTemplate";
import removeGitDir from "./removeGitDir";
import initGit from "./initGit";
import addAllFilesToGit from "./addAllFilesToGit";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import { writeJson } from "../../shared/commandUtils";

export const create = new Command("create");

create
  .description("Create a new integration project from the starter template")
  .argument("<name>", "Name of project")
  .addOption(
    new Option("-o, --output <format>", "Output format")
      .choices(["text", "json"])
      .default("text")
  )
  .addHelpText(
    "after",
    `
Examples:
  unscrambled create my-integration
  unscrambled create my-integration --output json
`
  )
  .action(async (name, commandOptions: { output: "text" | "json" }) => {
    const options = program.opts();
    if (options.debug) {
      setLogDisplayLevel("DEBUG");
      prepareConsole();
      console.debug("Outputting debug information");
    }

    await checkGitInstalled();
    await checkLocalDirectoryAvailable(name);
    const quiet = commandOptions.output === "json";
    await cloneFromTemplate(name, { quiet });
    await removeGitDir(name, { quiet });
    await initGit(name, { quiet });
    await addAllFilesToGit(name, { quiet });

    if (commandOptions.output === "json") {
      writeJson({
        projectName: name,
        path: name,
        gitInitialized: true,
      });
    }
  });
