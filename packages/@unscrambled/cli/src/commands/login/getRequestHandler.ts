import { RequestListener } from "http";
import fetchApiKey from "./fetchApiKey";
import writeConfigFile from "./writeConfigFile";
import parseCode from "./parseCode";
import { program } from "commander";
import { terminal } from "terminal-kit";
import { writeJson } from "../../shared/commandUtils";

function isJsonOutput(): boolean {
  return process.env.UNSCRAMBLED_CLI_OUTPUT_FORMAT === "json";
}

export default function getRequestHandler(baseUrl: string) {
  const callback: RequestListener = async (req, res) => {
    if (!isJsonOutput()) {
      terminal("Received response from browser\n");
    }

    res.statusCode = 302;

    const code = parseCode(req.url);
    if (!code) {
      res.setHeader("location", `${baseUrl}/cli-login/failed`);
      res.end();
      program.error("Failed to find code in url");
    }

    const { UNSCRAMBLED_API_KEY } = await fetchApiKey(baseUrl, code, res);
    const storage = await writeConfigFile(
      { UNSCRAMBLED_API_KEY, baseUrl },
      res
    );

    if (isJsonOutput()) {
      writeJson({
        status: "SUCCEEDED",
        baseUrl,
        storage,
      });
    }

    process.exit(0);
  };

  return callback;
}
