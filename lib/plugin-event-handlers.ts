import syncFs, { promises as fs, constants as fsConstants } from "fs";

import path from "path";

import stream from "stream";

import { EventEmitter } from "events";

import chalk from "chalk";

import { formatterHelpers, JsonFormatter } from "@cucumber/cucumber";

import { NdjsonToMessageStream } from "@cucumber/message-streams";

import CucumberHtmlStream from "@cucumber/html-formatter";

import messages from "@cucumber/messages";

import { HOOK_FAILURE_EXPR } from "./constants";

import {
  ITaskAppendMessages,
  ITaskCreateStringAttachment,
  ITaskTestCaseStarted,
  ITaskTestStepStarted,
} from "./cypress-task-definitions";

import { resolve as origResolve } from "./preprocessor-configuration";

import { ensureIsAbsolute } from "./helpers/paths";

import { createTimestamp } from "./helpers/messages";

import { notNull } from "./helpers/type-guards";

import { memoize } from "./helpers/memoize";

const resolve = memoize(origResolve);

let currentTestCaseStartedId: string;
let currentTestStepStartedId: string;
let currentSpecMessages: messages.Envelope[];

export async function beforeRunHandler(config: Cypress.PluginConfigOptions) {
  const preprocessor = await resolve(config, config.env, "/");

  if (!preprocessor.messages.enabled) {
    return;
  }

  const messagesPath = ensureIsAbsolute(
    config.projectRoot,
    preprocessor.messages.output
  );

  await fs.rm(messagesPath, { force: true });

  const testRunStarted: messages.Envelope = {
    testRunStarted: {
      timestamp: createTimestamp(),
    },
  };

  await fs.mkdir(path.dirname(messagesPath), { recursive: true });

  await fs.writeFile(messagesPath, JSON.stringify(testRunStarted) + "\n");
}

export async function afterRunHandler(config: Cypress.PluginConfigOptions) {
  const preprocessor = await resolve(config, config.env, "/");

  if (
    !preprocessor.messages.enabled &&
    !preprocessor.json.enabled &&
    !preprocessor.html.enabled
  ) {
    return;
  }

  const messagesPath = ensureIsAbsolute(
    config.projectRoot,
    preprocessor.messages.output
  );

  try {
    await fs.access(messagesPath, fsConstants.F_OK);
  } catch {
    return;
  }

  if (preprocessor.messages.enabled) {
    const testRunFinished: messages.Envelope = {
      testRunFinished: {
        /**
         * We're missing a "success" attribute here, but cucumber-js doesn't output it, so I won't.
         * Mostly because I don't want to look into the semantics of it right now.
         */
        timestamp: createTimestamp(),
      } as messages.TestRunFinished,
    };

    await fs.writeFile(messagesPath, JSON.stringify(testRunFinished) + "\n", {
      flag: "a",
    });
  }

  if (preprocessor.json.enabled) {
    const jsonPath = ensureIsAbsolute(
      config.projectRoot,
      preprocessor.json.output
    );

    await fs.mkdir(path.dirname(jsonPath), { recursive: true });

    const messages = (await fs.readFile(messagesPath))
      .toString()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    let jsonOutput: string | undefined;

    const log = (output: string | Uint8Array) => {
      if (typeof output !== "string") {
        throw new Error(
          "Expected a JSON output of string, but got " + typeof output
        );
      } else {
        jsonOutput = output;
      }
    };

    const eventBroadcaster = new EventEmitter();

    const eventDataCollector = new formatterHelpers.EventDataCollector(
      eventBroadcaster
    );

    const stepDefinitions = messages
      .map((m) => m.stepDefinition)
      .filter(notNull)
      .map((s) => {
        return {
          id: s.id,
          uri: "not available",
          line: 0,
        };
      });

    new JsonFormatter({
      eventBroadcaster,
      eventDataCollector,
      log,
      supportCodeLibrary: {
        stepDefinitions,
      } as any,
      colorFns: null as any,
      cwd: null as any,
      parsedArgvOptions: {},
      snippetBuilder: null as any,
      stream: null as any,
      cleanup: null as any,
    });

    for (const message of messages) {
      eventBroadcaster.emit("envelope", message);
    }

    if (typeof jsonOutput !== "string") {
      throw new Error(
        "Expected JSON formatter to have finished, but it never returned"
      );
    }

    await fs.writeFile(jsonPath, jsonOutput);
  }

  if (preprocessor.html.enabled) {
    const htmlPath = ensureIsAbsolute(
      config.projectRoot,
      preprocessor.html.output
    );

    await fs.mkdir(path.dirname(htmlPath), { recursive: true });

    const input = syncFs.createReadStream(messagesPath);

    const output = syncFs.createWriteStream(htmlPath);

    await new Promise<void>((resolve, reject) => {
      stream.pipeline(
        input,
        new NdjsonToMessageStream(),
        new CucumberHtmlStream(
          require.resolve("@cucumber/html-formatter/dist/main.css", {
            paths: [__dirname],
          }),
          require.resolve("@cucumber/html-formatter/dist/main.js", {
            paths: [__dirname],
          })
        ),
        output,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }
}

export async function beforeSpecHandler(_config: Cypress.PluginConfigOptions) {
  currentSpecMessages = [];
}

export async function afterSpecHandler(
  config: Cypress.PluginConfigOptions,
  spec: Cypress.Spec,
  results: CypressCommandLine.RunResult
) {
  const preprocessor = await resolve(config, config.env, "/");

  const messagesPath = ensureIsAbsolute(
    config.projectRoot,
    preprocessor.messages.output
  );

  // `results` is undefined when running via `cypress open`.
  if (!preprocessor.messages.enabled || !currentSpecMessages || !results) {
    return;
  }

  const wasRemainingSkipped = results.tests.some((test) =>
    test.displayError?.match(HOOK_FAILURE_EXPR)
  );

  if (wasRemainingSkipped) {
    console.log(
      chalk.yellow(
        `  Hook failures can't be represented in messages / JSON reports, thus none is created for ${spec.relative}.`
      )
    );
  } else {
    await fs.writeFile(
      messagesPath,
      currentSpecMessages.map((message) => JSON.stringify(message)).join("\n") +
        "\n",
      {
        flag: "a",
      }
    );
  }
}

export async function afterScreenshotHandler(
  config: Cypress.PluginConfigOptions,
  details: Cypress.ScreenshotDetails
) {
  const preprocessor = await resolve(config, config.env, "/");

  if (!preprocessor.messages.enabled || !currentSpecMessages) {
    return details;
  }

  let buffer;

  try {
    buffer = await fs.readFile(details.path);
  } catch {
    return details;
  }

  const message: messages.Envelope = {
    attachment: {
      testCaseStartedId: currentTestCaseStartedId,
      testStepId: currentTestStepStartedId,
      body: buffer.toString("base64"),
      mediaType: "image/png",
      contentEncoding:
        "BASE64" as unknown as messages.AttachmentContentEncoding.BASE64,
    },
  };

  currentSpecMessages.push(message);

  return details;
}

export function appendMessagesHandler(data: ITaskAppendMessages) {
  if (!currentSpecMessages) {
    return true;
  }

  currentSpecMessages.push(...data.messages);

  return true;
}

export function testCaseStartedHandler(data: ITaskTestCaseStarted) {
  if (!currentSpecMessages) {
    return true;
  }

  currentTestCaseStartedId = data.testCaseStartedId;

  return true;
}

export function testStepStartedHandler(data: ITaskTestStepStarted) {
  if (!currentSpecMessages) {
    return true;
  }

  currentTestStepStartedId = data.testStepId;

  return true;
}

export function createStringAttachmentHandler({
  data,
  mediaType,
  encoding,
}: ITaskCreateStringAttachment) {
  if (!currentSpecMessages) {
    return true;
  }

  const message: messages.Envelope = {
    attachment: {
      testCaseStartedId: currentTestCaseStartedId,
      testStepId: currentTestStepStartedId,
      body: data,
      mediaType: mediaType,
      contentEncoding: encoding,
    },
  };

  currentSpecMessages.push(message);

  return true;
}
