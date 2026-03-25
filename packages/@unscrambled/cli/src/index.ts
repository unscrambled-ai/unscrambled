#!/usr/bin/env node
import { program } from "commander";
import * as dotenv from "dotenv";
import packageJson from "../package.json";
import { setLogDisplayLevel } from "./shared/setLogDisplayLevel";
import { create } from "./commands/create";
import { login, signup } from "./commands/login";
import { logout } from "./commands/logout";
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
import { auth } from "./commands/auth";
import { app } from "./commands/app";
import { httpRequests } from "./commands/http-request";
// import { test } from "./commands/test";

dotenv.config();

prepareConsole();

program
  .name("unscrambled")
  .description("Unscrambled CLI")
  .version(packageJson.version)
  .addCommand(create)
  .addCommand(signup)
  .addCommand(login)
  .addCommand(logout)
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
  .addCommand(auth)
  .addCommand(app)
  .addCommand(httpRequests)
  .option("-d, --debug", "output extra debugging")
  .option("-e, --env <envName>", "Environment name (e.g. dev, prod)")
  .addHelpText("beforeAll", largeLogo)
  .addHelpText(
    "after",
    `
Common workflows:
  unscrambled dev
  unscrambled auth list --env dev
  unscrambled actions list --env prod
  unscrambled actions trigger self --env dev --managed-user-id mu_123
  unscrambled syncs trigger --env prod --integration hubspot --user ALL

Run 'unscrambled <command> --help' for command-specific examples.
`
  );

async function main() {
  const options = program.opts();
  if (options.debug) {
    setLogDisplayLevel("DEBUG");
    prepareConsole();
  }
  await program.parseAsync();
}
main();
