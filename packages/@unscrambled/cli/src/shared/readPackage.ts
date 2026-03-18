import { program } from "commander";
import * as fs from "fs";

export default function readPackage() {
  const pkgRaw = fs.readFileSync("package.json");
  const pkg = JSON.parse(pkgRaw.toString());

  if (!pkg.main) {
    program.error("Missing main in package.json", { exitCode: 1 });
  }

  return pkg;
}
