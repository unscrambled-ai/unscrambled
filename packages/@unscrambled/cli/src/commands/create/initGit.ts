import { program } from "commander";
import { execa } from "execa";

export default async function initGit(
  projectName: string,
  options: { quiet?: boolean } = {}
) {
  if (!options.quiet) {
    console.debug("Initializing git");
  }

  try {
    await execa("git", [`init`], {
      cwd: projectName,
    });
    if (!options.quiet) {
      console.debug("Successfully initialized git");
    }
  } catch (error) {
    console.error(error);
    program.error("Error initializing git repo");
  }
}
