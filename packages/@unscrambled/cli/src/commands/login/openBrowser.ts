import open from "open";
import { terminal } from "terminal-kit";

export default async function openBrowser(
  authUrl: string,
  baseUrl: string,
  accountType: "new" | "existing",
  localPort: number
) {
  if (accountType === "new") {
    terminal("Opening your browser to allow you to sign up\n");
  } else {
    terminal("Opening your browser to allow you to sign in\n");
  }

  const pagePrefix = accountType === "new" ? "/sign-up#/?redirect_url=" : "";

  await open(`${authUrl}${pagePrefix}/cli-login/port/${localPort}`);
}
