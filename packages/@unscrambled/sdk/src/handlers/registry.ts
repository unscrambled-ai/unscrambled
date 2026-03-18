import { exportRegistry, getRegistryStats } from "../registry";
import type {
  InternalResponse,
  RegistryExportHandler,
  RegistryStatsHandler,
} from "./types";

export const handleRegistryExport: RegistryExportHandler =
  async (): Promise<InternalResponse> => {
    const exported = exportRegistry();

    return {
      success: true,
      data: exported,
      stats: {
        totalItems: exported.items.length,
        exportedAt: new Date().toISOString(),
      },
    };
  };

export const handleRegistryStats: RegistryStatsHandler =
  async (): Promise<InternalResponse> => {
    const stats = getRegistryStats();

    return {
      success: true,
      data: {
        ...stats,
        createdAt: new Date().toISOString(),
      },
    };
  };
