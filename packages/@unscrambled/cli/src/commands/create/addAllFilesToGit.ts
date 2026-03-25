import { program } from "commander";
import { execa } from "execa";

export default async function addAllFilesToGit(
  projectName: string,
  options: { quiet?: boolean } = {}
) {
  if (!options.quiet) {
    console.debug("Adding all files to git");
  }

  try {
    await execa("git", ["add", "--all"], {
      cwd: projectName,
    });
    if (!options.quiet) {
      console.debug("Successfully added all files to git");
    }
  } catch (error) {
    console.error(error);
    program.error("Error adding files to git");
  }
}
