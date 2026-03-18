import pako from "pako";
import { pushOperation } from "../../shared/operationQueue";

export async function handleReceiveCustomAppWebhook(props: any) {
  const { compressedPayloadB64 } = props;
  const compressedPayload = Buffer.from(compressedPayloadB64, "base64");
  const payloadStr = pako.inflate(compressedPayload, { to: "string" });
  const payload = JSON.parse(payloadStr);

  console.debug("payload", payload);

  pushOperation({
    operation: "receiveCustomAppWebhook",
    params: {
      deliveryId: payload.deliveryId,
      customAppName: payload.customApp,
      authName: payload.authName,
      localResponseId: payload.localResponseId,
    },
  });
}
