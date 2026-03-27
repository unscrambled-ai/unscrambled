export type SupportedServiceAuthType = "OAUTH2" | "APIKEY";

export interface SupportedService {
  name: string;
  title: string;
  authType: SupportedServiceAuthType;
}

const supportedServices: SupportedService[] = [
  { name: "anthropic", title: "Anthropic", authType: "APIKEY" },
  { name: "hubspot", title: "HubSpot", authType: "OAUTH2" },
  { name: "openai", title: "OpenAI", authType: "APIKEY" },
  { name: "resend", title: "Resend", authType: "APIKEY" },
  { name: "salesforce", title: "Salesforce", authType: "OAUTH2" },
  { name: "stripe", title: "Stripe", authType: "APIKEY" },
];

export function getSupportedServices(): SupportedService[] {
  return [...supportedServices];
}

export function getSupportedService(
  serviceName: string
): SupportedService | undefined {
  return supportedServices.find((service) => service.name === serviceName);
}
