import syncFs, { promises as fs, constants as fsConstants } from "fs";

import path from "path";

import stream from "stream/promises";

import { EventEmitter } from "events";

import chalk from "chalk";

import { formatterHelpers, JsonFormatter } from "@cucumber/cucumber";

import { NdjsonToMessageStream } from "@cucumber/message-streams";

import CucumberHtmlStream from "@cucumber/html-formatter";

import messages from "@cucumber/messages";

import { HOOK_FAILURE_EXPR } from "./constants";

import {
  ITaskSpecEnvelopes,
  ITaskCreateStringAttachment,
  ITaskTestCaseStarted,
  ITaskTestStepStarted,
  ITaskTestStepFinished,
  ITaskTestCaseFinished,
} from "./cypress-task-definitions";

import { resolve as origResolve } from "./preprocessor-configuration";

import { ensureIsAbsolute } from "./helpers/paths";

import { createTimestamp } from "./helpers/messages";

import { notNull } from "./helpers/type-guards";

import { memoize } from "./helpers/memoize";

import debug from "./helpers/debug";

import { createError } from "./helpers/error";

const resolve = memoize(origResolve);

interface StateInitial {
  state: "initial";
}

interface StateBeforeSpec {
  state: "before-spec";
}

interface StateReceivedSpecEnvelopes {
  state: "received-envelopes";
  messages: messages.Envelope[];
}

interface StateTestStarted {
  state: "test-started";
  messages: messages.Envelope[];
  testCaseStartedId: string;
}

interface StateStepStarted {
  state: "step-started";
  messages: messages.Envelope[];
  testCaseStartedId: string;
  testStepStartedId: string;
}

interface StateStepFinished {
  state: "step-finished";
  messages: messages.Envelope[];
  testCaseStartedId: string;
}

interface StateTestFinished {
  state: "test-finished";
  messages: messages.Envelope[];
}

interface StateAfterSpec {
  state: "after-spec";
}

type State =
  | StateInitial
  | StateBeforeSpec
  | StateReceivedSpecEnvelopes
  | StateTestStarted
  | StateStepStarted
  | StateStepFinished
  | StateTestFinished
  | StateAfterSpec;

let state: State = {
  state: "initial",
};

const isFeature = (spec: Cypress.Spec) => spec.name.endsWith(".feature");

export async function beforeRunHandler(config: Cypress.PluginConfigOptions) {
  debug("beforeRunHandler()");

  if (!config.isTextTerminal) {
    return;
  }

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
  debug("afterRunHandler()");

  if (!config.isTextTerminal) {
    return;
  }

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
        throw createError(
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
      throw createError(
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

    await stream.pipeline(
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
      output
    );
  }
}

export async function beforeSpecHandler(
  config: Cypress.PluginConfigOptions,
  spec: Cypress.Spec
) {
  debug("beforeSpecHandler()");

  if (!config.isTextTerminal || !isFeature(spec)) {
    return;
  }

  const preprocessor = await resolve(config, config.env, "/");

  if (!preprocessor.messages.enabled) {
    return;
  }

  switch (state.state) {
    case "initial":
    case "after-spec":
      state = {
        state: "before-spec",
      };
      break;
    // This happens in case of visting a new domain, ref. https://github.com/cypress-io/cypress/issues/26300.
    // In this case, we want to disgard messages obtained in the current test and allow execution to continue
    // as if nothing happened.
    case "step-started":
      break;
    default:
      throw createError(
        "Unexpected state in beforeSpecHandler: " + state.state
      );
  }
}

export async function afterSpecHandler(
  config: Cypress.PluginConfigOptions,
  spec: Cypress.Spec,
  results: CypressCommandLine.RunResult
) {
  debug("afterSpecHandler()");

  if (!config.isTextTerminal || !isFeature(spec)) {
    return;
  }

  const preprocessor = await resolve(config, config.env, "/");

  const messagesPath = ensureIsAbsolute(
    config.projectRoot,
    preprocessor.messages.output
  );

  // `results` is undefined when running via `cypress open`.
  if (preprocessor.messages.enabled && results) {
    const wasRemainingSkipped = results.tests.some((test) =>
      test.displayError?.match(HOOK_FAILURE_EXPR)
    );

    if (wasRemainingSkipped) {
      console.log(
        chalk.yellow(
          `  Hook failures can't be represented in messages / JSON reports, thus none is created for ${spec.relative}.`
        )
      );
    } else if ("messages" in state) {
      await fs.writeFile(
        messagesPath,
        state.messages.map((message) => JSON.stringify(message)).join("\n") +
          "\n",
        {
          flag: "a",
        }
      );
    }
  }

  state = {
    state: "after-spec",
  };
}

export async function afterScreenshotHandler(
  config: Cypress.PluginConfigOptions,
  details: Cypress.ScreenshotDetails
) {
  debug("afterScreenshotHandler()");

  if (!config.isTextTerminal) {
    return details;
  }

  const preprocessor = await resolve(config, config.env, "/");

  if (!preprocessor.messages.enabled) {
    return details;
  }

  switch (state.state) {
    case "step-started":
      break;
    default:
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
      testCaseStartedId: state.testCaseStartedId,
      testStepId: state.testStepStartedId,
      body: buffer.toString("base64"),
      mediaType: "image/png",
      contentEncoding:
        "BASE64" as unknown as messages.AttachmentContentEncoding.BASE64,
    },
  };

  state.messages.push(message);

  return details;
}

export function specEnvelopesHandler(
  config: Cypress.PluginConfigOptions,
  data: ITaskSpecEnvelopes
) {
  debug("specEnvelopesHandler()");

  if (!config.isTextTerminal) {
    return true;
  }

  switch (state.state) {
    case "before-spec":
      break;
    // This happens in case of visting a new domain, ref. https://github.com/cypress-io/cypress/issues/26300.
    // In this case, we want to disgard messages obtained in the current test and allow execution to continue
    // as if nothing happened.
    case "step-started":
      {
        const iTestCaseStarted = state.messages.findLastIndex(
          (message) => !!message.testCaseStarted
        );

        if (iTestCaseStarted === -1) {
          throw createError("Expected to find a testCaseStarted envelope");
        }

        state = {
          state: "received-envelopes",
          messages: state.messages.slice(0, iTestCaseStarted),
        };
      }
      return true;
    default:
      throw createError(
        "Unexpected state in specEnvelopesHandler: " + state.state
      );
  }

  state = {
    state: "received-envelopes",
    messages: data.messages,
  };

  return true;
}

export function testCaseStartedHandler(
  config: Cypress.PluginConfigOptions,
  data: ITaskTestCaseStarted
) {
  debug("testCaseStartedHandler()");

  if (!config.isTextTerminal) {
    return true;
  }

  switch (state.state) {
    case "received-envelopes":
    case "test-finished":
      break;
    default:
      throw createError(
        "Unexpected state in testCaseStartedHandler: " + state.state
      );
  }

  state = {
    state: "test-started",
    messages: state.messages.concat({ testCaseStarted: data }),
    testCaseStartedId: data.id,
  };

  return true;
}

export function testStepStartedHandler(
  config: Cypress.PluginConfigOptions,
  data: ITaskTestStepStarted
) {
  debug("testStepStartedHandler()");

  if (!config.isTextTerminal) {
    return true;
  }

  switch (state.state) {
    case "test-started":
    case "step-finished":
      break;
    // This state can happen in cases where an error is "rescued".
    case "step-started":
      break;
    default:
      throw createError(
        "Unexpected state in testStepStartedHandler: " + state.state
      );
  }

  state = {
    state: "step-started",
    messages: state.messages.concat({ testStepStarted: data }),
    testCaseStartedId: state.testCaseStartedId,
    testStepStartedId: data.testStepId,
  };

  return true;
}

export function testStepFinishedHandler(
  config: Cypress.PluginConfigOptions,
  data: ITaskTestStepFinished
) {
  debug("testStepFinishedHandler()");

  if (!config.isTextTerminal) {
    return true;
  }

  switch (state.state) {
    case "step-started":
      break;
    default:
      throw createError(
        "Unexpected state in testStepFinishedHandler: " + state.state
      );
  }

  state = {
    state: "step-finished",
    messages: state.messages.concat({ testStepFinished: data }),
    testCaseStartedId: state.testCaseStartedId,
  };

  return true;
}

export function testCaseFinishedHandler(
  config: Cypress.PluginConfigOptions,
  data: ITaskTestCaseFinished
) {
  debug("testCaseFinishedHandler()");

  if (!config.isTextTerminal) {
    return true;
  }

  switch (state.state) {
    case "test-started":
    case "step-finished":
      break;
    default:
      throw createError(
        "Unexpected state in testCaseFinishedHandler: " + state.state
      );
  }

  state = {
    state: "test-finished",
    messages: state.messages.concat({ testCaseFinished: data }),
  };

  return true;
}

export async function createStringAttachmentHandler(
  config: Cypress.PluginConfigOptions,
  { data, mediaType, encoding }: ITaskCreateStringAttachment
) {
  debug("createStringAttachmentHandler()");

  if (!config.isTextTerminal) {
    return true;
  }

  const preprocessor = await resolve(config, config.env, "/");

  if (!preprocessor.messages.enabled) {
    return true;
  }

  switch (state.state) {
    case "step-started":
      break;
    default:
      throw createError(
        "Unexpected state in createStringAttachmentHandler: " + state.state
      );
  }

  const message: messages.Envelope = {
    attachment: {
      testCaseStartedId: state.testCaseStartedId,
      testStepId: state.testStepStartedId,
      body: data,
      mediaType: mediaType,
      contentEncoding: encoding,
    },
  };

  state.messages.push(message);

  return true;
}
