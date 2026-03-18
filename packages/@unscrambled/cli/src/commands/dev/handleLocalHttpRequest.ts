import pako from "pako";
import { execLocalHttpRequest } from "../../shared/execLocalHttpRequest";

export async function handleLocalHttpRequest(props: any) {
  const { compressedPayloadB64 } = props;
  const compressedPayload = Buffer.from(compressedPayloadB64, "base64");
  const payloadStr = pako.inflate(compressedPayload, { to: "string" });
  const payload = JSON.parse(payloadStr);

  console.debug("payload", payload);

  // Process immediately in parallel, independent of operation queue
  execLocalHttpRequest({ httpRequestId: payload.httpRequestId }).catch(
    (error) => {
      console.error(
        `Failed to process HTTP request ${payload.httpRequestId}:`,
        error
      );
    }
  );
}
