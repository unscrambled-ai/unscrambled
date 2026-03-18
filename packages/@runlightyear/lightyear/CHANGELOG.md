# @runlightyear/lightyear

## 2.4.0

### Minor Changes

- 59e3915: Stop logging http requests here as backend handle it now
- cfbf435: Flush logs at least every second so user doesn't experience lag

## 2.3.2

### Patch Changes

- ba944e1: Remove packages that required deprecated built-in punycode

## 2.3.1

### Patch Changes

- 5dbdca2cb: Switch to use vitest instead of jest

## 2.3.0

### Minor Changes

- 53d045710: Upgraded dependencies to get rid of deprecated subdependencies

## 2.2.1

### Patch Changes

- 151a1d266: Quiet the sync logs
- 4e9636802: Update dependencies to get rid of some package errors

## 2.2.0

### Minor Changes

- b0b12552d: Use the new delta api

## 2.1.0

### Minor Changes

- 8db84b0fb: Fixed bug: lastExternalId and lastExternalUpdatedAt not provided to list properly

## 2.0.0

### Major Changes

- b3413a3ec: New connector SDK for sync

## 1.21.0

### Minor Changes

- b4f7809e0: Refresh the auth data when necessary

### Patch Changes

- f989f6598: Log the requestId for every internal request

## 1.20.0

### Minor Changes

- b7aad45dc: Handle rate limits with exponential backoff + jitter logic

## 1.19.0

### Minor Changes

- f723e889d: Use new finish sync api
- 18e743421: Do not maintain log history when streaming logs back to server
- 3e7c405bd: Catch http request errors and print the body before the end of a run
- 86e21087b: Initial retry logic for http and base requests

## 1.18.0

### Minor Changes

- 403c0fc04: Retry retrieve delta call when response is 423 Locked

## 1.17.0

### Minor Changes

- 494972892: Model synchronizer uses updated sync api

## 1.16.0

### Minor Changes

- 406c62ad1: Handle unconfigured custom apps gracefully

### Patch Changes

- dc17a6cb9: Improve error message for misconfigured customApp

## 1.15.0

### Minor Changes

- d359a75eb: Added sync direction parameter to defineSyncIntegration and defineSyncAction
- ee03d9528: Added product and opportunityLineItem models to crm

### Patch Changes

- 7630cf2c1: Reduce log buffer size

## 1.14.1

### Patch Changes

- ca9afa760: Remove unused aws-lambda package
- 2a23428ce: Fixed: ModelSynchronizer using the wrong id during update

## 1.14.0

### Minor Changes

- 2945bf3af: Use the updated objects delta api

### Patch Changes

- 2c7824971: Fix bugs with streaming logs

## 1.13.0

### Minor Changes

- 41227e4f2: Reduce streaming log queue size to prevent errors
- 82a84c202: Support for upserting objects that do not have an updatedAt field
- ad4aaa49e: Use updated parameters for sync api calls
- 4210fc632: Crm account just matches on name for now

## 1.12.0

### Minor Changes

- 61ad46a3b: Turn on async logging of runs
- bbf9983cb: Fix Synchronizer initialization bug

## 1.11.0

### Minor Changes

- 2d9ee36f2: Prepare to support streaming logs

## 1.10.0

### Minor Changes

- e7dcf91c1: Added all major models for CRM collection
- e7dcf91c1: Use and update sync status

## 1.9.0

### Minor Changes

- 224005137: Unprotect constructor for GraphQLConnector
- 9ce4aae92: Sync action works with apps

## 1.8.0

### Minor Changes

- 05a3de7e4: Added defineSyncIntegration
- Added hubspot as an app
- Added defineSyncIntegration

## 1.7.0

### Minor Changes

- feacfd6c3: Update format of email addresses, phone numbers, and physical addresses for crm collections
- 83a17db8c: Enable some models in a collection

## 1.6.0

### Minor Changes

- Added module setting to package.json

## 1.5.0

### Minor Changes

- f5e7184d9: Allow use of extraData on auth

## 1.4.0

### Minor Changes

- f0077c3b3: Developer can define an integration
- 8c67e780f: Developer can define a collection
- 1b4c630f9: Actions can run on behalf of managed users and receive integration and managedUser props
- 686dd6441: Support for synchronizing collections and models

## 1.3.0

### Minor Changes

- f7eaf2615: defineCustomApp specified with connector prop does not require (or allow) authType

## 1.2.0

### Minor Changes

- e7add66c5: Added response_type code to authRequestUrl params
- ef13ac4a7: Support for defineCustomApp
- 2ac843f96: Support for custom app webhooks

## 1.1.0

### Minor Changes

- 88bc757af: Added sleep utility command

## 1.0.0

### Major Changes

- Lightyear is GA

## 0.38.1

### Patch Changes

- 4754e624b: Updated dependencies
- c2b776da8: Fixed: RestConnector.buildUrl was appending a ? even if there were no params

## 0.38.0

### Minor Changes

- 678e207c7: Make the deployList global so it can work across different versions of the @runlightyear/lightyear package

## 0.37.0

### Minor Changes

- 2914452a6: Authorizer support
- 2914452a6: RestConnector and GraphQLConnector become abstract classes

## 0.36.1

### Patch Changes

- efed4a0c7: Added some missing exports

## 0.36.0

### Minor Changes

- 4393656c3: Support for refreshing expiring webhook subscriptions

## 0.35.0

### Minor Changes

- 6f77253ea: Support for adding descriptions to variables and secrets

### Patch Changes

- da7c9a679: Console logs arrays properly

## 0.34.0

### Minor Changes

- Added a function to check if an error is an HttpProxyResponseError

## 0.33.0

### Minor Changes

- 7469fbe82: Removed unsupported description from defineAction

## 0.32.0

### Minor Changes

- 7e667cda1: Catch unknown keys in defineAction and defineWebhook

## 0.31.0

### Minor Changes

- Improved validation of defineAction and defineWebhook

## 0.30.0

### Minor Changes

- Updated the typescript target to es2020
- Added exports for RunFunc parameters

## 0.29.0

### Minor Changes

- Updated documentation on defineAction and defineWebhook

### Patch Changes

- 862932a7: Added missing export

## 0.28.1

### Patch Changes

- Bump version to cope with npm problem

## 0.28.0

### Minor Changes

- Refactor index.ts to just use exports

## 0.27.0

### Minor Changes

- Support for debugging deployList issues

## 0.26.0

### Minor Changes

- RestConnector sets auth error after 401 response

## 0.25.0

### Minor Changes

- Support for refreshing access tokens on custom apps

## 0.24.0

### Minor Changes

- Custom apps supported

## 0.23.0

### Minor Changes

- Support for Zoom

### Patch Changes

- First version

## 0.22.0

### Minor Changes

- 44796238: Export dayjsUtc

## 0.21.0

### Minor Changes

- Added salesforce

## 0.20.1

### Patch Changes

- 820276f3: Added some debugging around action and webhook defintions

## 0.20.0

### Minor Changes

- Set variables and secrets from runs and subscribe/unsubscribes

## 0.19.0

### Minor Changes

- Updated support for GraphQL

## 0.18.0

### Minor Changes

- Support for Slack webhooks

## 0.17.2

### Patch Changes

- Added some debugging for webhooks

## 0.17.1

### Patch Changes

- Cleaned up deploy logging

## 0.17.0

### Minor Changes

- 6fb536f: Standardize on the term props for parameters passed as an object
- Support for Smtp
- 6fb536f: Migrate terminology from Oauth to OAuth
- 6fb536f: Updated documentation

## 0.16.0

### Minor Changes

- Flexibility to specify oauth token request params
- Initial support for GraphQL connectors

## 0.15.0

### Minor Changes

- 36fa04b: Support LIGHTYEAR_API_KEY environment variable

## 0.14.0

### Minor Changes

- Added support for OpenAI

## 0.13.0

### Minor Changes

- Added subscribeProps operation

## 0.12.4

### Patch Changes

- Added debug statement to display environment

## 0.12.3

### Patch Changes

- Fix bug that required all webhooks to have subscriptionProps

## 0.12.2

### Patch Changes

- Initialize the console at start of each operation

## 0.12.1

### Patch Changes

- Export SKIPPED for run functions to throw when necessary

## 0.12.0

### Minor Changes

- Support for skipping runs

## 0.11.0

### Minor Changes

- Improvements to logging

## 0.10.1

### Patch Changes

- Fixed bug with defineWebhook props

## 0.10.0

### Minor Changes

- Support for webhook subscriptions

## 0.9.0

### Minor Changes

- Require title on defineWebhook

## 0.8.0

### Minor Changes

- Updated support for webhooks

## 0.7.0

### Minor Changes

- New specification of apps, variables, and secrets

## 0.6.0

### Minor Changes

- Temporarily disable some deploy features while we iterate on the app

## 0.5.0

### Minor Changes

- Updated oauth2 support to work with new app

## 0.4.0

### Minor Changes

- Added required title to defineAction

## 0.3.0

### Minor Changes

- Updated terminology

## 0.2.0

### Minor Changes

- Updates to work with new production version of lightyear

## 0.1.1

### Patch Changes

- Updated README

## 0.1.0

### Minor Changes

- Initial version
