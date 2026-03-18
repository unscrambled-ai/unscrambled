import execa from "execa";
import { program } from "commander";

export default async function getFileList() {
  try {
    const result = await execa("git", ["ls-files"]);
    return result.stdout.split("\n");
  } catch (error) {
    console.error(error);
    program.error("Error getting file list");
  }
}
