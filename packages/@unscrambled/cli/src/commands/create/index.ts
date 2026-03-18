import { Command, program } from "commander";
import checkLocalDirectoryAvailable from "./checkLocalDirectoryAvailable";
import checkGitInstalled from "./checkGitInstalled";
import cloneFromTemplate from "./cloneFromTemplate";
import removeGitDir from "./removeGitDir";
import initGit from "./initGit";
import addAllFilesToGit from "./addAllFilesToGit";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";

export const create = new Command("create");

create
  .description("Create a new integration project from the starter template")
  .argument("<name>", "Name of project")
  .action(async (name) => {
    const options = program.opts();
    if (options.debug) {
      setLogDisplayLevel("DEBUG");
      prepareConsole();
      console.debug("Outputting debug information");
    }

    await checkGitInstalled();
    await checkLocalDirectoryAvailable(name);
    await cloneFromTemplate(name);
    await removeGitDir(name);
    await initGit(name);
    await addAllFilesToGit(name);
  });
