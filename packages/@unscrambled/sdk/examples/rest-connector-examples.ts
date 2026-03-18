/**
 * REST Connector Examples
 *
 * Various examples showing how to create REST connectors with different configurations
 */

import { createRestConnector, RestConnector } from "../src";

/**
 * Define a REST connector
 */

const simpleConnector = createRestConnector().build();

/**
 * Define a REST connector with a base URL
 */

const baseUrlConnector = createRestConnector()
  .withBaseUrl("https://api.example.com/v1")
  .build();

/**
 * Define a REST connector with a base URL and an Authorization header using an API key
 */

const apiKeyConnector = createRestConnector()
  .withBaseUrl("https://api.weather.com/v2")
  .addHeader("Authorization", "ApiKey {{secrets.weather_api_key}}")
  .build();

/**
 * Define a REST connector with a base URL and a header and an Authorization header using an access token
 */

const tokenConnector = createRestConnector()
  .withBaseUrl("https://api.github.com")
  .addHeader("Accept", "application/vnd.github.v3+json")
  .addHeader("Authorization", "Bearer {{auths.github.accessToken}}")
  .build();

/**
 * Define a duplicate REST connector from an instantiated connector
 */

const duplicateTokenConnector = createRestConnector
  .from(tokenConnector)
  .withBaseUrl("https://api.githubenterprise.com")
  .withHeaders({
    Accept: "application/vnd.github.v3+json",
    Authorization: "Bearer {{auths.github_enterprise.accessToken}}",
  })
  .build();

// Export examples for reference
export { simpleConnector, baseUrlConnector, apiKeyConnector, tokenConnector };
