import fse from "fs-extra";
import { TEMP_TGZ_FILE } from "./constants";

export default async function deleteTgz() {
  await fse.unlink(TEMP_TGZ_FILE);
}
