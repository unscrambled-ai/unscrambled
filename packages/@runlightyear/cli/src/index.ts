#!/usr/bin/env node
import { program } from "commander";
import * as dotenv from "dotenv";
import packageJson from "../package.json";
import { setLogDisplayLevel } from "./shared/setLogDisplayLevel";
import { create } from "./commands/create";
import { login, signup } from "./commands/login";
import { dev } from "./commands/dev";
import { deploy } from "./commands/deploy";
import { prepareConsole } from "./logging";
import { largeLogo } from "./largeLogo";
import { build } from "./commands/build-command";
import { trigger } from "./commands/trigger";
import { syncs } from "./commands/sync";
import { collections } from "./commands/collection";
import { objects } from "./commands/object";
import { managedUsers } from "./commands/managed-user";
import { runs } from "./commands/run";
import { integrations } from "./commands/integration";
import { actions } from "./commands/action";
import { envs } from "./commands/env";
import { httpRequests } from "./commands/http-request";
// import { test } from "./commands/test";

dotenv.config();

prepareConsole();

program
  .name("lightyear")
  .description("Lightyear CLI")
  .version(packageJson.version)
  .addCommand(create)
  .addCommand(signup)
  .addCommand(login)
  .addCommand(build)
  .addCommand(dev)
  .addCommand(deploy)
  .addCommand(trigger)
  .addCommand(syncs)
  .addCommand(collections)
  .addCommand(objects)
  .addCommand(managedUsers)
  .addCommand(runs)
  .addCommand(integrations)
  .addCommand(actions)
  .addCommand(envs)
  .addCommand(httpRequests)
  .option("-d, --debug", "output extra debugging")
  .option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  .addHelpText("beforeAll", largeLogo);

async function main() {
  const options = program.opts();
  if (options.debug) {
    setLogDisplayLevel("DEBUG");
    prepareConsole();
  }
  await program.parseAsync();
}
main();
