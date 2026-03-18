import type {
  Integration,
  CustomApp,
  Collection,
  Action,
  SyncSchedule,
} from "../types";
import { registerIntegration } from "../registry";

/**
 * Integration Builder - fluent API for creating integrations
 */
export class IntegrationBuilder {
  private name: string;
  private title?: string;
  private description?: string;
  private app?: Integration["app"];
  private collection?: Collection;
  private actions: Record<string, Action> = {};
  private syncSchedules?: SyncSchedule[];
  private readOnly?: boolean;
  private writeOnly?: boolean;
  private modelPermissions?: Array<{
    model: string;
    readOnly?: boolean;
    writeOnly?: boolean;
  }>;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Copy-constructor: create a builder from an existing integration or builder
   */
  static from(source: Integration | IntegrationBuilder): IntegrationBuilder {
    const builder = new IntegrationBuilder(
      source instanceof IntegrationBuilder ? (source as any).name : source.name
    );
    const title =
      source instanceof IntegrationBuilder
        ? (source as any).title
        : source.title;
    if (title) builder.withTitle(title);
    const description =
      source instanceof IntegrationBuilder
        ? (source as any).description
        : (source as any).description;
    if (description) builder.withDescription(description);
    const app =
      source instanceof IntegrationBuilder ? (source as any).app : source.app;
    if (app) {
      if (app.type === "builtin") builder.withApp(app.name);
      if (app.type === "custom" && app.definition)
        builder.withCustomApp(app.definition);
    }
    const collection =
      source instanceof IntegrationBuilder
        ? (source as any).collection
        : source.collection;
    if (collection) builder.withCollection(collection);
    const actions =
      source instanceof IntegrationBuilder
        ? ((source as any).actions as Record<string, Action>)
        : (source.actions as Record<string, Action>);
    if (actions) {
      const actionList = Object.values(actions) as Action[];
      builder.withActions(actionList);
    }
    const syncSchedules =
      source instanceof IntegrationBuilder
        ? (source as any).syncSchedules
        : source.syncSchedules;
    if (syncSchedules) builder.withSyncSchedules(syncSchedules);
    const readOnly =
      source instanceof IntegrationBuilder
        ? (source as any).readOnly
        : (source as any).readOnly;
    if (readOnly !== undefined) {
      builder.asReadOnly();
    }
    const writeOnly =
      source instanceof IntegrationBuilder
        ? (source as any).writeOnly
        : (source as any).writeOnly;
    if (writeOnly !== undefined) {
      builder.asWriteOnly();
    }
    const modelPermissions =
      source instanceof IntegrationBuilder
        ? (source as any).modelPermissions
        : (source as any).modelPermissions;
    if (modelPermissions) {
      builder.withModelPermissions(modelPermissions);
    }
    return builder;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Use a built-in app provided by Unscrambled
   */
  withApp(appName: string): this {
    this.app = {
      type: "builtin",
      name: appName,
    };
    return this;
  }

  /**
   * Use a custom app defined in your code
   */
  withCustomApp(customApp: CustomApp): this {
    this.app = {
      type: "custom",
      name: customApp.name,
      definition: customApp,
    };
    return this;
  }

  /**
   * Set the collection for this integration (required)
   */
  withCollection(collection: Collection): this {
    this.collection = collection;
    return this;
  }

  /**
   * Set the actions on this integration (override any previously set actions)
   */
  withAction(action: Action): this;
  withAction(...actions: Action[]): this;
  withAction(...actions: Action[]): this {
    this.actions = {};
    actions.forEach((action) => {
      this.actions[action.name] = action;
    });
    return this;
  }

  /**
   * Set multiple actions on this integration (override any previously set actions)
   */
  withActions(...actions: Action[]): this;
  withActions(actions: Action[]): this;
  withActions(...actionsOrArray: Action[] | [Action[]]): this {
    const actions = Array.isArray(actionsOrArray[0])
      ? (actionsOrArray[0] as Action[])
      : (actionsOrArray as Action[]);
    this.actions = {};
    actions.forEach((action) => {
      this.actions[action.name] = action;
    });
    return this;
  }

  /**
   * Add one or more actions (incremental, does not clear existing)
   */
  addAction(action: Action): this;
  addAction(...actions: Action[]): this;
  addAction(...actions: Action[]): this {
    actions.forEach((action) => {
      this.actions[action.name] = action;
    });
    return this;
  }

  /**
   * Add multiple actions (incremental, does not clear existing)
   */
  addActions(...actions: Action[]): this;
  addActions(actions: Action[]): this;
  addActions(...actionsOrArray: Action[] | [Action[]]): this {
    const actions = Array.isArray(actionsOrArray[0])
      ? (actionsOrArray[0] as Action[])
      : (actionsOrArray as Action[]);
    actions.forEach((action) => {
      this.actions[action.name] = action;
    });
    return this;
  }

  /**
   * Set sync schedules for this integration (override any previously set schedules)
   */
  withSyncSchedules(...schedules: SyncSchedule[]): this;
  withSyncSchedules(schedules: SyncSchedule[]): this;
  withSyncSchedules(schedules: {
    incremental?: { every?: number | string };
    full?: { every?: number | string };
    baseline?: { every?: number | string; maxRetries: number };
  }): this;
  withSyncSchedules(
    ...schedulesOrArray:
      | SyncSchedule[]
      | [SyncSchedule[]]
      | [
          {
            incremental?: { every?: number | string };
            full?: { every?: number | string };
            baseline?: { every?: number | string; maxRetries: number };
          }
        ]
  ): this {
    // Check if it's the object format
    const firstArg = schedulesOrArray[0];
    if (
      firstArg &&
      !Array.isArray(firstArg) &&
      typeof firstArg === "object" &&
      ("incremental" in firstArg ||
        "full" in firstArg ||
        "baseline" in firstArg)
    ) {
      const scheduleObj = firstArg as {
        incremental?: { every?: number | string };
        full?: { every?: number | string };
        baseline?: { every?: number | string; maxRetries: number };
      };
      const schedules: SyncSchedule[] = [];
      if (scheduleObj.incremental) {
        schedules.push({
          type: "INCREMENTAL",
          every: scheduleObj.incremental.every,
        });
      }
      if (scheduleObj.full) {
        schedules.push({ type: "FULL", every: scheduleObj.full.every });
      }
      if (scheduleObj.baseline) {
        schedules.push({
          type: "BASELINE",
          every: scheduleObj.baseline.every,
          maxRetries: scheduleObj.baseline.maxRetries,
        });
      }
      this.syncSchedules = schedules;
      return this;
    }

    // If it's an object but doesn't have incremental/full/baseline, treat as empty (clear schedules)
    if (
      firstArg &&
      !Array.isArray(firstArg) &&
      typeof firstArg === "object" &&
      !("incremental" in firstArg) &&
      !("full" in firstArg) &&
      !("baseline" in firstArg)
    ) {
      this.syncSchedules = undefined;
      return this;
    }

    // Array format
    const schedules = Array.isArray(firstArg)
      ? (firstArg as SyncSchedule[])
      : (schedulesOrArray as SyncSchedule[]);
    this.syncSchedules = schedules;
    return this;
  }

  /**
   * Add a sync schedule (incremental, does not clear existing)
   */
  addSyncSchedule(schedule: SyncSchedule): this;
  addSyncSchedule(...schedules: SyncSchedule[]): this;
  addSyncSchedule(...schedules: SyncSchedule[]): this {
    if (!this.syncSchedules) {
      this.syncSchedules = [];
    }
    this.syncSchedules.push(...schedules);
    return this;
  }

  /**
   * Add multiple sync schedules (incremental, does not clear existing)
   */
  addSyncSchedules(...schedules: SyncSchedule[]): this;
  addSyncSchedules(schedules: SyncSchedule[]): this;
  addSyncSchedules(
    ...schedulesOrArray: SyncSchedule[] | [SyncSchedule[]]
  ): this {
    const schedules = Array.isArray(schedulesOrArray[0])
      ? (schedulesOrArray[0] as SyncSchedule[])
      : (schedulesOrArray as SyncSchedule[]);
    if (!this.syncSchedules) {
      this.syncSchedules = [];
    }
    this.syncSchedules.push(...schedules);
    return this;
  }

  /**
   * Mark entire integration as read-only (skip push operations)
   */
  asReadOnly(): this {
    this.readOnly = true;
    return this;
  }

  /**
   * Mark entire integration as write-only (skip pull operations)
   */
  asWriteOnly(): this {
    this.writeOnly = true;
    return this;
  }

  /**
   * Mark specific models as read-only
   * Convenience method that converts to modelPermissions format
   */
  withReadOnlyModels(modelNames: string[]): this {
    if (!this.modelPermissions) {
      this.modelPermissions = [];
    }
    // Remove any existing entries for these models first
    this.modelPermissions = this.modelPermissions.filter(
      (p) => !modelNames.includes(p.model)
    );
    // Add new entries
    modelNames.forEach((modelName) => {
      this.modelPermissions!.push({ model: modelName, readOnly: true });
    });
    return this;
  }

  /**
   * Mark specific models as write-only
   * Convenience method that converts to modelPermissions format
   */
  withWriteOnlyModels(modelNames: string[]): this {
    if (!this.modelPermissions) {
      this.modelPermissions = [];
    }
    // Remove any existing entries for these models first
    this.modelPermissions = this.modelPermissions.filter(
      (p) => !modelNames.includes(p.model)
    );
    // Add new entries
    modelNames.forEach((modelName) => {
      this.modelPermissions!.push({ model: modelName, writeOnly: true });
    });
    return this;
  }

  /**
   * Set model-specific permissions directly
   */
  withModelPermissions(
    permissions: Array<{
      model: string;
      readOnly?: boolean;
      writeOnly?: boolean;
    }>
  ): this {
    this.modelPermissions = permissions;
    return this;
  }

  deploy(): Integration {
    if (!this.app) {
      throw new Error(
        `Integration "${this.name}" requires an app. Use .withApp() for built-in apps or .withCustomApp() for custom apps.`
      );
    }

    if (!this.collection) {
      throw new Error(
        `Integration "${this.name}" requires a collection. Use .withCollection() to specify one.`
      );
    }

    // Validation: Cannot have both readOnly and writeOnly set to true
    if (this.readOnly === true && this.writeOnly === true) {
      throw new Error(
        `Integration "${this.name}" cannot be both read-only and write-only. Remove one of the flags.`
      );
    }

    // Validation: Check model permissions for conflicts
    if (this.modelPermissions) {
      const modelSet = new Set<string>();
      for (const perm of this.modelPermissions) {
        // Check for duplicate models
        if (modelSet.has(perm.model)) {
          throw new Error(
            `Integration "${this.name}" has duplicate model "${perm.model}" in modelPermissions. Each model should appear only once.`
          );
        }
        modelSet.add(perm.model);

        // Check for conflicting flags on same model
        if (perm.readOnly === true && perm.writeOnly === true) {
          throw new Error(
            `Integration "${this.name}" model "${perm.model}" cannot be both read-only and write-only.`
          );
        }

        // Check if integration-level readOnly conflicts with model writeOnly
        if (this.readOnly === true && perm.writeOnly === true) {
          throw new Error(
            `Integration "${this.name}" is read-only but model "${perm.model}" is marked as write-only. Remove the conflicting configuration.`
          );
        }

        // Check if integration-level writeOnly conflicts with model readOnly
        if (this.writeOnly === true && perm.readOnly === true) {
          throw new Error(
            `Integration "${this.name}" is write-only but model "${perm.model}" is marked as read-only. Remove the conflicting configuration.`
          );
        }
      }
    }

    const integration: Integration = {
      name: this.name,
      title: this.title,
      description: this.description,
      app: this.app,
      collection: this.collection,
      actions: this.actions,
      syncSchedules: this.syncSchedules,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly,
      modelPermissions: this.modelPermissions,
    };

    // Register the integration in the global registry
    registerIntegration(integration, {
      builderType: "IntegrationBuilder",
      createdBy: "defineIntegration",
      appType: this.app.type,
      collectionName: this.collection.name,
      actionCount: Object.keys(this.actions).length,
    });

    return integration;
  }
}

/**
 * Factory function for creating an integration builder
 */
export interface DefineIntegrationFn {
  (name: string): IntegrationBuilder;
  from: (source: Integration | IntegrationBuilder) => IntegrationBuilder;
}

export const defineIntegration: DefineIntegrationFn = ((name: string) =>
  new IntegrationBuilder(name)) as unknown as DefineIntegrationFn;

defineIntegration.from = (source: Integration | IntegrationBuilder) =>
  IntegrationBuilder.from(source);
