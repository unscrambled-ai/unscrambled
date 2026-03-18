import { RequestListener } from "http";
import fetchApiKey from "./fetchApiKey";
import writeConfigFile from "./writeConfigFile";
import parseCode from "./parseCode";
import { program } from "commander";
import { terminal } from "terminal-kit";

export default function getRequestHandler(baseUrl: string) {
  const callback: RequestListener = async (req, res) => {
    terminal("Received response from browser\n");

    res.statusCode = 302;

    const code = parseCode(req.url);
    if (!code) {
      res.setHeader("location", `${baseUrl}/cli-login/failed`);
      res.end();
      program.error("Failed to find code in url");
    }

    const { LIGHTYEAR_API_KEY } = await fetchApiKey(baseUrl, code, res);
    await writeConfigFile({ LIGHTYEAR_API_KEY, baseUrl }, res);

    process.exit(0);
  };

  return callback;
}
