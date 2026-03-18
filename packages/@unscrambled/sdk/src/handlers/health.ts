import type { InternalResponse, HandlerContext, HealthHandler } from "./types";

export const handleHealth: HealthHandler = async (
  context?: HandlerContext
): Promise<InternalResponse> => {
  return {
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      remainingTimeMs: context?.remainingTimeMs || 30000,
      memoryLimitMB: context?.memoryLimitMB || "unknown",
      runtime: process.version,
      nodeEnv: process.env.NODE_ENV || "unknown",
      requestId: context?.requestId || `req-${Date.now()}`,
    },
  };
};
