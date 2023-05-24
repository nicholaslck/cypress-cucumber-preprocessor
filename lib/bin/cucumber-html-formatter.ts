#!/usr/bin/env node

import stream from "stream";

import { NdjsonToMessageStream } from "@cucumber/message-streams";

import CucumberHtmlStream from "@cucumber/html-formatter";

stream.pipeline(
  process.stdin,
  new NdjsonToMessageStream(),
  new CucumberHtmlStream(
    require.resolve("@cucumber/html-formatter/dist/main.css", {
      paths: [__dirname],
    }),
    require.resolve("@cucumber/html-formatter/dist/main.js", {
      paths: [__dirname],
    })
  ),
  process.stdout,
  (err) => {
    if (err && err.code !== "EPIPE") {
      console.error(err.stack);
      process.exitCode = 1;
    }
  }
);
