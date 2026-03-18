import { program } from "commander";
import execa from "execa";

const TEMPLATE_URL = "https://github.com/unscrambled-ai/unscrambled-template";

export default async function cloneFromTemplate(projectName: string) {
  console.info("Cloning from template into directory", projectName);

  try {
    await execa("git", [
      `clone`,
      TEMPLATE_URL,
      projectName,
      `--recursive`,
      `--depth=1`,
      `--quiet`,
    ]);
  } catch (error) {
    console.log(error);
    program.error("Error cloning repo");
  }
}
