import * as fs from "fs";

export default function getCompiledCode(main: string) {
  return fs.readFileSync(main);
}
