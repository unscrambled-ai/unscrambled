import { createServer, RequestListener } from "http";
import { program } from "commander";
import { AddressInfo } from "net";

export default async function startServer(callback: RequestListener) {
  const server = createServer(callback);

  server.listen(0);

  const address = server.address() as AddressInfo;

  if (!address) {
    program.error("Error starting local server");
  }

  return address.port;
}
