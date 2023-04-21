import assert from "assert";

import {
  CucumberExpressionGenerator,
  ParameterTypeRegistry,
} from "@cucumber/cucumber-expressions";

import { stripIndent } from "./helpers/strings";

import { generateSnippet } from "./snippets";

function example(options: {
  description: string;
  pattern: string;
  parameter?: "dataTable" | "docString";
  expected: string;
}) {
  context(options.description, () => {
    it("returns the proper snippet", () => {
      const snippets = new CucumberExpressionGenerator(
        () => new ParameterTypeRegistry().parameterTypes
      ).generateExpressions(options.pattern);

      const actual = generateSnippet(snippets[0], options.parameter ?? null);

      assert.strictEqual(actual, options.expected);
    });
  });
}

describe("generateSnippet()", () => {
  example({
    description: "simplest pattern",
    pattern: "a step",
    expected: stripIndent(`
      Given("a step", function () {
        return "pending";
      });
    `).trim(),
  });

  example({
    description: "with docstring",
    parameter: "docString",
    pattern: "a step",
    expected: stripIndent(`
      Given("a step", function (docString) {
        return "pending";
      });
    `).trim(),
  });

  example({
    description: "with datatable",
    parameter: "dataTable",
    pattern: "a step",
    expected: stripIndent(`
      Given("a step", function (dataTable) {
        return "pending";
      });
    `).trim(),
  });

  example({
    description: "string argument",
    pattern: 'a "step"',
    expected: stripIndent(`
      Given("a {string}", function (string) {
        return "pending";
      });
    `).trim(),
  });

  example({
    description: "number argument",
    pattern: "1 step",
    expected: stripIndent(`
      Given("{int} step", function (int) {
        return "pending";
      });
    `).trim(),
  });
});
