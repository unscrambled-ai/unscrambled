import pako from "pako";
import { pushOperation } from "../../shared/operationQueue";

export default async function handleRequestAccessToken(props: any) {
  const { compressedPayloadB64 } = props;
  const compressedPayload = Buffer.from(compressedPayloadB64, "base64");
  const payloadStr = pako.inflate(compressedPayload, { to: "string" });
  const payload = JSON.parse(payloadStr);

  console.debug("payload", payload);

  pushOperation({
    operation: "requestAccessToken",
    params: {
      customAppName: payload.customApp,
      authName: payload.authName,
      code: payload.code,
      localResponseId: payload.localResponseId,
    },
  });
}
