export interface HandlerEvent {
  operation:
    | "deploy"
    | "health"
    | "registry-export"
    | "registry-stats"
    | "run"
    | "getAuthRequestUrl"
    | "requestAccessToken"
    | "refreshAccessToken";
  payload?: any;
  // CLI-specific fields
  deployId?: string;
  logDisplayLevel?: string;
  // Run-specific fields
  actionName?: string;
  runId?: string;
  data?: any;
  context?: any;
  auths?: any;
  variables?: any;
  secrets?: any;
  webhook?: any;
  integration?: any;
  managedUser?: any;
  // OAuth-specific fields
  customAppName?: string;
  authName?: string;
  code?: string;
}

export interface HandlerResponse {
  statusCode: number;
  body: string;
}

export interface HandlerContext {
  remainingTimeMs?: number;
  memoryLimitMB?: string;
  functionName?: string;
  requestId?: string;
  [key: string]: any;
}

export type DirectHandler = (
  event: HandlerEvent,
  context: HandlerContext
) => Promise<HandlerResponse>;

// Individual handler function types
// Internal response format before converting to Lambda format
export interface InternalResponse {
  success: boolean;
  data?: any;
  error?: string;
  stats?: any;
  logs?: string[];
}

export type HealthHandler = (
  context?: HandlerContext
) => Promise<InternalResponse>;
export type RegistryExportHandler = () => Promise<InternalResponse>;
export type RegistryStatsHandler = () => Promise<InternalResponse>;
export type DeployHandler = (payload?: any) => Promise<InternalResponse>;
export type RunHandler = (payload?: any) => Promise<InternalResponse>;
