import { program } from "commander";
import execa from "execa";

export default async function initGit(projectName: string) {
  console.debug("Initializing git");

  try {
    await execa("git", [`init`], {
      cwd: projectName,
    });
    console.debug("Successfully initialized git");
  } catch (error) {
    console.log(error);
    program.error("Error initializing git repo");
  }
}
