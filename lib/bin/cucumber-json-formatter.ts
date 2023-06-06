#!/usr/bin/env node

import { pipeline } from "stream/promises";

import { Writable } from "stream";

import { EventEmitter } from "events";

import { formatterHelpers, JsonFormatter } from "@cucumber/cucumber";

import { NdjsonToMessageStream } from "@cucumber/message-streams";

import messages from "@cucumber/messages";

import { createError } from "../helpers/error";

import { notNull } from "../helpers/type-guards";

const envelopes: messages.Envelope[] = [];

pipeline(
  process.stdin,
  new NdjsonToMessageStream(),
  new Writable({
    objectMode: true,
    write(envelope: messages.Envelope, _: BufferEncoding, callback) {
      envelopes.push(envelope);
      callback();
    },
  })
)
  .then(() => {
    const eventBroadcaster = new EventEmitter();

    const eventDataCollector = new formatterHelpers.EventDataCollector(
      eventBroadcaster
    );

    const stepDefinitions = envelopes
      .map((m) => m.stepDefinition)
      .filter(notNull)
      .map((s) => {
        return {
          id: s.id,
          uri: "not available",
          line: 0,
        };
      });

    const log = (output: string | Uint8Array) => {
      if (typeof output !== "string") {
        throw createError(
          "Expected a JSON output of string, but got " + typeof output
        );
      } else {
        console.log(output);
      }
    };

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

    for (const message of envelopes) {
      eventBroadcaster.emit("envelope", message);
    }
  })
  .catch((err) => {
    console.error(err.stack);
    process.exitCode = 1;
  });
