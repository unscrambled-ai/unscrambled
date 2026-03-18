import { program } from "commander";
import commandExists from "command-exists";

export default async function checkGitInstalled() {
  try {
    await commandExists("git");
  } catch (error) {
    console.log("You must have git installed to run the create command");
    program.error("git not found");
  }
}
