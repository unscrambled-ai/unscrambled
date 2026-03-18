import { Command, Option, program } from "commander";
import getPusher from "../../shared/getPusher";
import getPusherCredentials from "../../shared/getPusherCredentials";
import handleRunLocal from "./handleRunLocal";
import nodemon from "nodemon";
import { terminal } from "terminal-kit";
import {
  setLogDisplayLevel,
  logDisplayLevel,
} from "../../shared/setLogDisplayLevel";
import { prepareConsole } from "../../logging";
import handleResubscribe from "./handleResubscribe";
import { largeLogo } from "../../largeLogo";
import { pushOperation } from "../../shared/operationQueue";
import { handleLocalHttpRequest } from "./handleLocalHttpRequest";
import {
  pauseOperationQueue,
  resumeOperationQueue,
} from "../../shared/operationQueue";
import handleGetAuthRequestUrl from "./handleGetAuthRequestUrl";
import handleRequestAccessToken from "./handleRequestAccessToken";
import handleRefreshAccessToken from "./handleRefreshAccessToken";
import { handleRefreshSubscription } from "./handleRefreshSubscription";
import { handleReceiveCustomAppWebhook } from "./handleReceiveCustomAppWebhook";
import { trigger as triggerCommand } from "../trigger";
import getQueuedRuns from "../../shared/getQueuedRuns";
import execDeployAndSubscribe from "../../shared/execDeployAndSubscribe";
import { requireAuth } from "../../shared/requireAuth";

export const dev = new Command("dev");

dev
  .description(
    "Automatically deploy changes, run actions, and respond to webhooks in your dev environment"
  )
  .addOption(new Option("--dev").hideHelp())
  .action(async () => {
    // `lightyear dev` is explicitly tied to the dev environment.
    // Set env vars early so shared helpers and logging behave consistently.
    process.env.LIGHTYEAR_ENV = "dev";
    process.env.ENV_NAME = "dev";

    requireAuth();

    terminal(largeLogo);
    terminal("\n\n");

    const options = program.opts();
    if (options.debug) {
      setLogDisplayLevel("DEBUG");
      prepareConsole();
      console.debug("Outputting debug information");
    }

    const devEnvironment = "dev";

    // Connect to Pusher and check for other dev servers BEFORE deploying
    const credentials = await getPusherCredentials();
    const pusher = await getPusher(credentials);

    console.debug(
      `Attempting to subscribe to presence channel ${credentials.devEnvId}\n`
    );
    const presenceSubscription = pusher.subscribe(
      `presence-${credentials.devEnvId}`
    );

    // Wait for presence subscription and check for other dev servers
    try {
      await new Promise<void>((resolve, reject) => {
        presenceSubscription.bind(
          "pusher:subscription_succeeded",
          (members: {
            count: number;
            me: { id: string };
            each: (cb: (member: { id: string }) => void) => void;
          }) => {
            console.debug("Subscribed to presence channel");

            // Count only OTHER dev servers (server_ prefix, excluding ourselves)
            const myId = members.me?.id;
            let otherServerCount = 0;
            members.each((member: { id: string }) => {
              if (member.id.startsWith("server_") && member.id !== myId) {
                otherServerCount++;
              }
            });

            if (otherServerCount > 0) {
              terminal.red("\n❌ Another dev server is already running!\n\n");
              terminal(
                "Only one dev server can run at a time per environment.\n"
              );
              terminal("Please stop the other dev server and try again.\n\n");
              reject(new Error("Another dev server is already running"));
            } else {
              resolve();
            }
          }
        );

        presenceSubscription.bind(
          "pusher:subscription_error",
          (error: unknown) => {
            console.error("Failed to subscribe to presence channel:", error);
            // Continue anyway - don't block on presence channel errors
            resolve();
          }
        );

        // Timeout after 10 seconds
        setTimeout(() => {
          console.debug(
            "Presence channel subscription timed out, continuing..."
          );
          resolve();
        }, 10000);
      });
    } catch {
      process.exit(1);
    }

    // Warn if another dev server attempts to join while we're running
    presenceSubscription.bind(
      "pusher:member_added",
      (member: { id: string }) => {
        if (member.id.startsWith("server_")) {
          terminal.yellow(
            "\n⚠️  Another dev server attempted to connect (it should exit automatically).\n"
          );
        }
      }
    );

    terminal("Deploying latest build to dev...\n");
    try {
      await execDeployAndSubscribe(devEnvironment);
    } catch (error) {
      terminal.red("Initial dev deploy failed.\n");
      console.error(error);
    }

    console.debug(
      "Attempting to subscribe to regular channel",
      credentials.devEnvId
    );
    const subscription = pusher.subscribe(credentials.devEnvId);
    subscription.bind("pusher:subscription_succeeded", () => {
      console.debug("Subscribed to regular channel");
    });

    subscription.bind("localRunTriggered", handleRunLocal);
    subscription.bind("localResubscribeTriggered", handleResubscribe);
    subscription.bind(
      "localGetAuthRequestUrlTriggered",
      handleGetAuthRequestUrl
    );
    subscription.bind(
      "localRequestAccessTokenTriggered",
      handleRequestAccessToken
    );
    subscription.bind(
      "localRefreshAccessTokenTriggered",
      handleRefreshAccessToken
    );
    subscription.bind(
      "localRefreshSubscriptionTriggered",
      handleRefreshSubscription
    );
    subscription.bind(
      "localReceiveCustomAppWebhookTriggered",
      handleReceiveCustomAppWebhook
    );
    subscription.bind("localHttpRequestCreated", handleLocalHttpRequest);

    // On startup, fetch any queued runs and enqueue them oldest-first
    try {
      terminal("\nChecking for queued runs...\n");
      const queued = await getQueuedRuns(devEnvironment);
      if (queued.length > 0) {
        terminal(`Found ${queued.length} queued run(s). Adding to queue...\n`);
        for (const item of queued) {
          pushOperation({
            operation: "run",
            params: {
              actionName: item.actionName,
              runId: item.id,
              data: item.data,
              deliveryId: item.deliveryId,
              environment: devEnvironment,
            },
          });
        }
      } else {
        terminal("No queued runs found.\n");
      }
    } catch (e) {
      terminal.red("Failed to enqueue queued runs on startup\n");
      console.debug(e);
    }

    nodemon({
      ignoreRoot: [".git"],
      watch: ["src", "node_modules/@runlightyear/lightyear/dist"],
      ext: "js,ts",
      execMap: {
        js: "npx lightyear build",
      },
    });

    terminal.on("key", async (name: string, matches: any, data: any) => {
      if (data.code === "q" || data.code === "\u0003") {
        terminal.grabInput(false);
        setTimeout(function () {
          process.exit();
        }, 100);
      } else if (data.code === "d") {
        pushOperation({
          operation: "deploy",
          params: { environment: devEnvironment },
        });
      } else if (data.code === "t") {
        // Execute the trigger command interactively
        terminal.grabInput(false);
        pauseOperationQueue(); // Pause the queue while trigger is active
        try {
          await triggerCommand.parseAsync([
            "node",
            "lightyear",
            "trigger",
            "--interactive",
            "--env",
            devEnvironment,
          ]);
        } finally {
          resumeOperationQueue(); // Always resume the queue
          terminal.grabInput(true);
        }
      } else if (data.code === "l") {
        if (logDisplayLevel === "DEBUG") {
          console.info("DEBUG logging off");
          setLogDisplayLevel("INFO");
        } else {
          console.info("DEBUG logging on");
          setLogDisplayLevel("DEBUG");
        }
        prepareConsole();
      } else if (data.code === "h") {
        terminal("\n");
        terminal("  press d to deploy\n");
        terminal("  press t to trigger an action\n");
        terminal(
          `  press l to turn DEBUG logs ${
            logDisplayLevel === "DEBUG" ? "off" : "on"
          }\n`
        );
        terminal("  press q to quit\n");
        terminal("\n");
      } else {
        // terminal(`got key: '${name}'\n`);
        // terminal(`got matches: '${matches}'\n`);
        // terminal(`got data: '${JSON.stringify(data)}'\n`);
      }
    });

    nodemon.on("exit", async () => {
      pushOperation({
        operation: "deploy",
        params: { environment: devEnvironment },
      });
      terminal.grabInput(true);
    });
  });
