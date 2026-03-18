import { Command, program } from "commander";
import { execBuild } from "../../shared/execBuild";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";

export const build = new Command("build");

build.description("Build the project").action(async () => {
  const options = program.opts();
  if (options.debug) {
    setLogDisplayLevel("DEBUG");
    prepareConsole();
    console.debug("Outputting debug information");
  }

  await execBuild();
});
