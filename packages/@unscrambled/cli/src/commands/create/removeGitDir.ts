import { program } from "commander";
import fs from "fs";
import * as path from "path";

export default async function removeGitDir(
  projectName: string,
  options: { quiet?: boolean } = {}
) {
  if (!options.quiet) {
    console.debug("Removing .git dir");
  }

  try {
    fs.rmSync(path.join(projectName, ".git"), { recursive: true });
    if (!options.quiet) {
      console.debug("Successfully removed .git dir");
    }
  } catch (error) {
    console.error(error);
    program.error("Error removing .git dir");
  }
}
