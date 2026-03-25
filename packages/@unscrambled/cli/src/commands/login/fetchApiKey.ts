import { program } from "commander";
import { ServerResponse } from "http";
import { terminal } from "terminal-kit";

function isJsonOutput(): boolean {
  return process.env.UNSCRAMBLED_CLI_OUTPUT_FORMAT === "json";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractApiKeyFromLoginResponse(
  payload: unknown
): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const directApiKey =
    payload.UNSCRAMBLED_API_KEY ??
    payload.LIGHTYEAR_API_KEY ??
    payload.apiKey;
  if (typeof directApiKey === "string" && directApiKey.trim()) {
    return directApiKey;
  }

  if (!isRecord(payload.data)) {
    return undefined;
  }

  const nestedApiKey =
    payload.data.UNSCRAMBLED_API_KEY ??
    payload.data.LIGHTYEAR_API_KEY ??
    payload.data.apiKey;
  if (typeof nestedApiKey === "string" && nestedApiKey.trim()) {
    return nestedApiKey;
  }

  return undefined;
}

export default async function fetchApiKey(
  baseUrl: string,
  code: string,
  res: ServerResponse
) {
  try {
    if (!isJsonOutput()) {
      terminal("Fetching credentials\n");
    }
    const response = await fetch(`${baseUrl}/api/v1/cli-login/key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    const text = await response.text();
    const json = JSON.parse(text);

    if (response.status !== 200) {
      console.error(json.message);
      program.error("Error fetching api key");
    }

    const UNSCRAMBLED_API_KEY = extractApiKeyFromLoginResponse(json);
    if (!UNSCRAMBLED_API_KEY) {
      program.error(
        "Error fetching api key: login response did not include an API key"
      );
    }

    return { UNSCRAMBLED_API_KEY };
  } catch (error) {
    console.log("error", error);
    res.setHeader("location", `${baseUrl}/cli-login/failed`);
    res.end();
    program.error("Login failed");
  }
}
