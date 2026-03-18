import { program } from "commander";
import execa from "execa";

export default async function addAllFilesToGit(projectName: string) {
  console.debug("Adding all files to git");

  try {
    await execa("git", ["add", "--all"], {
      cwd: projectName,
    });
    console.debug("Successfully added all files to git");
  } catch (error) {
    console.log(error);
    program.error("Error adding files to git");
  }
}
