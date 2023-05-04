import { ICypressPost10Configuration } from "@badeball/cypress-configuration";

import assert from "assert";

import {
  IPreprocessorConfiguration,
  IUserConfiguration,
  resolve,
} from "./preprocessor-configuration";

const DUMMY_POST10_CONFIG: ICypressPost10Configuration = {
  projectRoot: "",
  specPattern: [],
  excludeSpecPattern: [],
  env: {},
};

async function test<T>(options: {
  environment: Record<string, unknown>;
  configuration: IUserConfiguration;
  expectedValue: T;
  getValueFn(configuration: IPreprocessorConfiguration): T;
}) {
  const configuration = await resolve(
    DUMMY_POST10_CONFIG,
    options.environment,
    "cypress/e2e",
    () => options.configuration
  );

  assert.deepStrictEqual(
    options.getValueFn(configuration),
    options.expectedValue
  );
}

function createUserConfiguration<T>(options: {
  setValueFn(configuration: IUserConfiguration, value: T): void;
  value: T;
}): IUserConfiguration {
  const configuration: IUserConfiguration = {};
  options.setValueFn(configuration, options.value);
  return configuration;
}

function basicBooleanExample(options: {
  default: boolean;
  environmentKey: string;
  setValueFn(configuration: IUserConfiguration, value: boolean): void;
  getValueFn(configuration: IPreprocessorConfiguration): boolean;
}) {
  const { environmentKey, setValueFn, getValueFn } = options;

  it("default", async () => {
    test({
      getValueFn,
      environment: {},
      configuration: {},
      expectedValue: options.default,
    });
  });

  it("override by explicit configuration (boolean)", () => {
    test({
      getValueFn,
      environment: {},
      configuration: createUserConfiguration({ setValueFn, value: true }),
      expectedValue: true,
    });
  });

  it("override by environment (boolean)", () => {
    test({
      getValueFn,
      environment: { [environmentKey]: true },
      configuration: {},
      expectedValue: true,
    });
  });

  it("precedence", () => {
    test({
      getValueFn,
      environment: { [environmentKey]: true },
      configuration: createUserConfiguration({ setValueFn, value: false }),
      expectedValue: true,
    });
  });

  describe("environment string interpretation", () => {
    const matrix = [
      { environmentValue: "true", expectedValue: true },
      { environmentValue: "foobar", expectedValue: true },
      { environmentValue: "0", expectedValue: false },
      { environmentValue: "false", expectedValue: false },
    ];

    for (const { environmentValue, expectedValue } of matrix) {
      it(JSON.stringify(environmentValue), () => {
        test({
          getValueFn,
          environment: { [environmentKey]: environmentValue },
          configuration: createUserConfiguration({
            setValueFn,
            value: !expectedValue,
          }),
          expectedValue: expectedValue,
        });
      });
    }

    // defers to next value
    it('"" and explicit value', () => {
      test({
        getValueFn,
        environment: { [environmentKey]: "" },
        configuration: createUserConfiguration({
          setValueFn,
          value: true,
        }),
        expectedValue: true,
      });
    });

    it('"" and no explicit values', () => {
      test({
        getValueFn,
        environment: { [environmentKey]: "" },
        configuration: {},
        expectedValue: false,
      });
    });
  });
}

function basicStringExample(options: {
  default: string;
  environmentKey: string;
  setValueFn(configuration: IUserConfiguration, value: string): void;
  getValueFn(configuration: IPreprocessorConfiguration): string;
}) {
  const { environmentKey, setValueFn, getValueFn } = options;

  it("default", async () => {
    test({
      getValueFn,
      environment: {},
      configuration: {},
      expectedValue: options.default,
    });
  });

  it("override by explicit configuration", () => {
    test({
      getValueFn,
      environment: {},
      configuration: createUserConfiguration({ setValueFn, value: "foo" }),
      expectedValue: "foo",
    });
  });

  it("override by environment", () => {
    test({
      getValueFn,
      environment: { [environmentKey]: "foo" },
      configuration: {},
      expectedValue: "foo",
    });
  });

  it("precedence", () => {
    test({
      getValueFn,
      environment: { [environmentKey]: "bar" },
      configuration: createUserConfiguration({ setValueFn, value: "foo" }),
      expectedValue: "bar",
    });
  });
}

describe("resolve()", () => {
  describe("stepDefinitions", () => {
    const getValueFn = (
      configuration: IPreprocessorConfiguration
    ): string | string[] => configuration.stepDefinitions;

    it("default", () =>
      test({
        getValueFn,
        environment: {},
        configuration: {},
        expectedValue: [
          "cypress/e2e/[filepath]/**/*.{js,mjs,ts,tsx}",
          "cypress/e2e/[filepath].{js,mjs,ts,tsx}",
          "cypress/support/step_definitions/**/*.{js,mjs,ts,tsx}",
        ],
      }));

    it("override by explicit configuration (string)", () =>
      test({
        getValueFn,
        environment: {},
        configuration: { stepDefinitions: "foo" },
        expectedValue: "foo",
      }));

    it("override by explicit configuration (string[])", () =>
      test({
        getValueFn,
        environment: {},
        configuration: { stepDefinitions: ["foo"] },
        expectedValue: ["foo"],
      }));

    it("override by environment (string)", () =>
      test({
        getValueFn,
        environment: { stepDefinitions: "foo" },
        configuration: {},
        expectedValue: "foo",
      }));

    it("override by environment (string[])", () =>
      test({
        getValueFn,
        environment: { stepDefinitions: ["foo"] },
        configuration: {},
        expectedValue: ["foo"],
      }));

    it("precedence", () =>
      test({
        getValueFn,
        environment: { stepDefinitions: "bar" },
        configuration: { stepDefinitions: "foo" },
        expectedValue: "bar",
      }));
  });

  describe("messages", () => {
    describe("enabled", () => {
      const getValueFn = (configuration: IPreprocessorConfiguration): boolean =>
        configuration.messages.enabled;

      const setValueFn = (configuration: IUserConfiguration, value: boolean) =>
        (configuration.messages = { enabled: value });

      basicBooleanExample({
        default: false,
        environmentKey: "messagesEnabled",
        getValueFn,
        setValueFn,
      });

      it("overriden by json.enabled", () =>
        test({
          getValueFn,
          environment: {},
          configuration: {
            messages: {
              enabled: false,
            },
            json: {
              enabled: true,
            },
          },
          expectedValue: true,
        }));

      it("overriden by html.enabled", () =>
        test({
          getValueFn,
          environment: {},
          configuration: {
            messages: {
              enabled: false,
            },
            html: {
              enabled: true,
            },
          },
          expectedValue: true,
        }));
    });

    describe("output", () => {
      const getValueFn = (configuration: IPreprocessorConfiguration): string =>
        configuration.messages.output;

      const setValueFn = (configuration: IUserConfiguration, value: string) =>
        (configuration.messages = { enabled: true, output: value });

      basicStringExample({
        default: "cucumber-messages.ndjson",
        environmentKey: "messagesOutput",
        getValueFn,
        setValueFn,
      });
    });
  });

  describe("json", () => {
    describe("enabled", () => {
      const getValueFn = (configuration: IPreprocessorConfiguration): boolean =>
        configuration.json.enabled;

      const setValueFn = (configuration: IUserConfiguration, value: boolean) =>
        (configuration.json = { enabled: value });

      basicBooleanExample({
        default: false,
        environmentKey: "jsonEnabled",
        getValueFn,
        setValueFn,
      });
    });

    describe("output", () => {
      const getValueFn = (configuration: IPreprocessorConfiguration): string =>
        configuration.json.output;

      const setValueFn = (configuration: IUserConfiguration, value: string) =>
        (configuration.json = { enabled: true, output: value });

      basicStringExample({
        default: "cucumber-report.json",
        environmentKey: "jsonOutput",
        getValueFn,
        setValueFn,
      });
    });
  });

  describe("html", () => {
    describe("enabled", () => {
      const getValueFn = (configuration: IPreprocessorConfiguration): boolean =>
        configuration.html.enabled;

      const setValueFn = (configuration: IUserConfiguration, value: boolean) =>
        (configuration.html = { enabled: value });

      basicBooleanExample({
        default: false,
        environmentKey: "htmlEnabled",
        getValueFn,
        setValueFn,
      });
    });

    describe("output", () => {
      const getValueFn = (configuration: IPreprocessorConfiguration): string =>
        configuration.json.output;

      const setValueFn = (configuration: IUserConfiguration, value: string) =>
        (configuration.json = { enabled: true, output: value });

      basicStringExample({
        default: "cucumber-report.html",
        environmentKey: "htmlOutput",
        getValueFn,
        setValueFn,
      });
    });
  });

  describe("filterSpecs", () => {
    const getValueFn = (configuration: IPreprocessorConfiguration): boolean =>
      configuration.filterSpecs;

    const setValueFn = (configuration: IUserConfiguration, value: boolean) =>
      (configuration.filterSpecs = value);

    basicBooleanExample({
      default: false,
      environmentKey: "filterSpecs",
      getValueFn,
      setValueFn,
    });
  });

  describe("omitFiltered", () => {
    const getValueFn = (configuration: IPreprocessorConfiguration): boolean =>
      configuration.omitFiltered;

    const setValueFn = (configuration: IUserConfiguration, value: boolean) =>
      (configuration.omitFiltered = value);

    basicBooleanExample({
      default: false,
      environmentKey: "omitFiltered",
      getValueFn,
      setValueFn,
    });
  });
});
