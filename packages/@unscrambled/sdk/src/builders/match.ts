import type { MatchPattern } from "../types";

/**
 * Match pattern helpers for creating data matching rules
 */
export const match = {
  /**
   * Match a simple property name
   */
  property: (prop: string): MatchPattern => prop,

  /**
   * Match using JSONPath syntax
   */
  jsonPath: (path: string): MatchPattern => `$${path}` as const,

  /**
   * Create an OR pattern - matches if any of the patterns match
   */
  or: (...patterns: MatchPattern[]): MatchPattern => ({
    or: patterns,
  }),

  /**
   * Create an AND pattern - matches if all patterns match
   */
  and: (...patterns: MatchPattern[]): MatchPattern => ({
    and: patterns,
  }),
};
