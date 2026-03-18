import * as fs from "fs";
import { program } from "commander";

export default async function checkLocalDirectoryAvailable(repo: string) {
  if (fs.existsSync(repo)) {
    program.error(
      `Directory or file ${repo} already exists. Delete or choose another name to continue.`
    );
  }
}
