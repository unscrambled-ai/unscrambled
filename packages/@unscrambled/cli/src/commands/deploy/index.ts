import { Command, Option, program } from "commander";
import deployToProd from "./deployToProd";
import { setLogDisplayLevel } from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import { requireAuth } from "../../shared/requireAuth";

export const deploy = new Command("deploy");

deploy
  .description("Deploy the integrations to an env (only prod for now)")
  .argument("<env>", "Environment (only 'prod' for now)")
  .action(async (env) => {
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
      await deployToProd();
    } else {
      program.error(`Unknown env: ${env}. Should be 'prod'.`);
    }
  });
