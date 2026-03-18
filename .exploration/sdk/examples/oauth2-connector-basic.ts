import { defineCustomApp } from '../app-builder';
import { defineOAuth2Connector, OAuth2Connector } from '../oauth2-connector';

/**
 * Basic OAuth2 connector examples
 */

const myApp = defineCustomApp('my_oauth_app', 'OAUTH2')
  .withTitle('My OAuth App')
  .build();

// Basic OAuth2 connector with standard flow
const basicConnector = defineOAuth2Connector(myApp)
  .withClientCredentials('my-client-id', 'my-client-secret')
  .withEndpoints(
    'https://api.example.com/oauth/authorize',
    'https://api.example.com/oauth/token'
  )
  .withScopes('read', 'write')
  .build();

// Using the connector
async function demonstrateOAuth2Flow() {
  // Step 1: Generate authorization URL
  const authRequest = basicConnector.buildAuthorizationUrl('random-state-123');
  console.log('Redirect user to:', authRequest.url);
  // https://api.example.com/oauth/authorize?client_id=my-client-id&redirect_uri=https://platform.unscrambled.ai/oauth/callback/my_oauth_app&response_type=code&state=random-state-123&scope=read%20write

  // Step 2: After user authorizes and we receive the code
  const code = 'auth-code-from-callback';
  const tokenResponse = await basicConnector.exchangeCodeForToken(code);
  console.log('Access token:', tokenResponse.access_token);

  // Step 3: Calculate expiration
  const expiresAt = basicConnector.calculateExpiresAt(tokenResponse);
  console.log('Token expires at:', expiresAt);

  // Step 4: Refresh token when needed
  if (tokenResponse.refresh_token) {
    const refreshedToken = await basicConnector.refreshAccessToken(tokenResponse.refresh_token);
    console.log('New access token:', refreshedToken.access_token);
  }
}

// Custom redirect URI
const customRedirectConnector = defineOAuth2Connector(myApp)
  .withClientCredentials('my-client-id', 'my-client-secret')
  .withEndpoints(
    'https://api.example.com/oauth/authorize',
    'https://api.example.com/oauth/token'
  )
  .withRedirectUri('https://mycompany.unscrambled.ai/oauth/callback')
  .build();

// Multiple scopes with custom formatting
const scopedConnector = defineOAuth2Connector(myApp)
  .withClientCredentials('my-client-id', 'my-client-secret')
  .withEndpoints(
    'https://api.example.com/oauth/authorize',
    'https://api.example.com/oauth/token'
  )
  .withScopes('user:read', 'user:write', 'admin:read')
  .build();