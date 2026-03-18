import { pushOperation } from "../../shared/operationQueue";
import pako from "pako";

export async function handleRefreshSubscription(props: any) {
  console.debug("in handleRefreshSubscription");

  const { compressedPayloadB64 } = props;
  const compressedPayload = Buffer.from(compressedPayloadB64, "base64");
  const payloadStr = pako.inflate(compressedPayload, { to: "string" });
  const payload = JSON.parse(payloadStr);

  console.log("handleRefreshSubscription with payload", payload);

  pushOperation({
    operation: "refreshSubscription",
    params: {
      webhookName: payload.webhookName,
      activityId: payload.activityId,
    },
  });
}
