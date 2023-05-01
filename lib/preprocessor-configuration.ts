import { ICypressConfiguration } from "@badeball/cypress-configuration";

import { cosmiconfig } from "cosmiconfig";

import util from "util";

import debug from "./helpers/debug";

import { ensureIsRelative } from "./helpers/paths";

import {
  isString,
  isStringOrStringArray,
  isBoolean,
} from "./helpers/type-guards";

function hasOwnProperty<X extends Record<string, unknown>, Y extends string>(
  value: X,
  property: Y
): value is X & Record<Y, unknown> {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function validateUserConfigurationEntry(
  key: string,
  value: Record<string, unknown>
): Partial<IUserConfiguration> {
  switch (key) {
    case "stepDefinitions":
      if (!isStringOrStringArray(value)) {
        throw new Error(
          `Expected a string or array of strings (stepDefinitions), but got ${util.inspect(
            value
          )}`
        );
      }
      return { [key]: value };
    case "messages": {
      if (typeof value !== "object" || value == null) {
        throw new Error(
          `Expected an object (messages), but got ${util.inspect(value)}`
        );
      }
      if (
        !hasOwnProperty(value, "enabled") ||
        typeof value.enabled !== "boolean"
      ) {
        throw new Error(
          `Expected a boolean (messages.enabled), but got ${util.inspect(
            value.enabled
          )}`
        );
      }
      let output: string | undefined;
      if (hasOwnProperty(value, "output")) {
        if (isString(value.output)) {
          output = value.output;
        } else {
          throw new Error(
            `Expected a string (messages.output), but got ${util.inspect(
              value.output
            )}`
          );
        }
      }
      const messagesConfig = {
        enabled: value.enabled,
        output,
      };
      return { [key]: messagesConfig };
    }
    case "json": {
      if (typeof value !== "object" || value == null) {
        throw new Error(
          `Expected an object (json), but got ${util.inspect(value)}`
        );
      }
      if (
        !hasOwnProperty(value, "enabled") ||
        typeof value.enabled !== "boolean"
      ) {
        throw new Error(
          `Expected a boolean (json.enabled), but got ${util.inspect(
            value.enabled
          )}`
        );
      }
      let output: string | undefined;
      if (hasOwnProperty(value, "output")) {
        if (isString(value.output)) {
          output = value.output;
        } else {
          throw new Error(
            `Expected a string (json.output), but got ${util.inspect(
              value.output
            )}`
          );
        }
      }
      const messagesConfig = {
        enabled: value.enabled,
        output,
      };
      return { [key]: messagesConfig };
    }
    case "html": {
      if (typeof value !== "object" || value == null) {
        throw new Error(
          `Expected an object (json), but got ${util.inspect(value)}`
        );
      }
      if (
        !hasOwnProperty(value, "enabled") ||
        typeof value.enabled !== "boolean"
      ) {
        throw new Error(
          `Expected a boolean (html.enabled), but got ${util.inspect(
            value.enabled
          )}`
        );
      }
      let output: string | undefined;
      if (hasOwnProperty(value, "output")) {
        if (isString(value.output)) {
          output = value.output;
        } else {
          throw new Error(
            `Expected a string (html.output), but got ${util.inspect(
              value.output
            )}`
          );
        }
      }
      const messagesConfig = {
        enabled: value.enabled,
        output,
      };
      return { [key]: messagesConfig };
    }
    case "filterSpecs": {
      if (!isBoolean(value)) {
        throw new Error(
          `Expected a boolean (filterSpecs), but got ${util.inspect(value)}`
        );
      }
      return { [key]: value };
    }
    case "omitFiltered": {
      if (!isBoolean(value)) {
        throw new Error(
          `Expected a boolean (omitFiltered), but got ${util.inspect(value)}`
        );
      }
      return { [key]: value };
    }
    default:
      return {};
  }
}

function validateEnvironmentOverrides(
  environment: Record<string, unknown>
): IEnvironmentOverrides {
  const overrides: IEnvironmentOverrides = {};

  if (hasOwnProperty(environment, "stepDefinitions")) {
    const { stepDefinitions } = environment;

    if (isStringOrStringArray(stepDefinitions)) {
      overrides.stepDefinitions = stepDefinitions;
    } else {
      throw new Error(
        `Expected a string or array of strings (stepDefinitions), but got ${util.inspect(
          stepDefinitions
        )}`
      );
    }
  }

  if (hasOwnProperty(environment, "messagesEnabled")) {
    const { messagesEnabled } = environment;

    if (isBoolean(messagesEnabled)) {
      overrides.messagesEnabled = messagesEnabled;
    } else if (isString(messagesEnabled)) {
      overrides.messagesEnabled = stringToMaybeBoolean(messagesEnabled);
    } else {
      throw new Error(
        `Expected a boolean (messagesEnabled), but got ${util.inspect(
          messagesEnabled
        )}`
      );
    }
  }

  if (hasOwnProperty(environment, "messagesOutput")) {
    const { messagesOutput } = environment;

    if (isString(messagesOutput)) {
      overrides.messagesOutput = messagesOutput;
    } else {
      throw new Error(
        `Expected a string (messagesOutput), but got ${util.inspect(
          messagesOutput
        )}`
      );
    }
  }

  if (hasOwnProperty(environment, "jsonEnabled")) {
    const { jsonEnabled } = environment;

    if (isBoolean(jsonEnabled)) {
      overrides.jsonEnabled = jsonEnabled;
    } else if (isString(jsonEnabled)) {
      overrides.jsonEnabled = stringToMaybeBoolean(jsonEnabled);
    } else {
      throw new Error(
        `Expected a boolean (jsonEnabled), but got ${util.inspect(jsonEnabled)}`
      );
    }
  }

  if (hasOwnProperty(environment, "jsonOutput")) {
    const { jsonOutput } = environment;

    if (isString(jsonOutput)) {
      overrides.jsonOutput = jsonOutput;
    } else {
      throw new Error(
        `Expected a string (jsonOutput), but got ${util.inspect(jsonOutput)}`
      );
    }
  }

  if (hasOwnProperty(environment, "htmlEnabled")) {
    const { htmlEnabled } = environment;

    if (isBoolean(htmlEnabled)) {
      overrides.htmlEnabled = htmlEnabled;
    } else if (isString(htmlEnabled)) {
      overrides.htmlEnabled = stringToMaybeBoolean(htmlEnabled);
    } else {
      throw new Error(
        `Expected a boolean (htmlEnabled), but got ${util.inspect(htmlEnabled)}`
      );
    }
  }

  if (hasOwnProperty(environment, "htmlOutput")) {
    const { htmlOutput } = environment;

    if (isString(htmlOutput)) {
      overrides.htmlOutput = htmlOutput;
    } else {
      throw new Error(
        `Expected a string (htmlOutput), but got ${util.inspect(htmlOutput)}`
      );
    }
  }

  if (hasOwnProperty(environment, "filterSpecs")) {
    const { filterSpecs } = environment;

    if (isBoolean(filterSpecs)) {
      overrides.filterSpecs = filterSpecs;
    } else if (isString(filterSpecs)) {
      overrides.filterSpecs = stringToMaybeBoolean(filterSpecs);
    } else {
      throw new Error(
        `Expected a boolean (filterSpecs), but got ${util.inspect(filterSpecs)}`
      );
    }
  }

  if (hasOwnProperty(environment, "omitFiltered")) {
    const { omitFiltered } = environment;

    if (isBoolean(omitFiltered)) {
      overrides.omitFiltered = omitFiltered;
    } else if (isString(omitFiltered)) {
      overrides.omitFiltered = stringToMaybeBoolean(omitFiltered);
    } else {
      throw new Error(
        `Expected a boolean (omitFiltered), but got ${util.inspect(
          omitFiltered
        )}`
      );
    }
  }

  return overrides;
}

function stringToMaybeBoolean(value: string): boolean | undefined {
  if (value === "") {
    return;
  }

  const falsyValues = ["0", "false"];

  if (falsyValues.includes(value)) {
    return false;
  } else {
    return true;
  }
}

interface IEnvironmentOverrides {
  stepDefinitions?: string | string[];
  messagesEnabled?: boolean;
  messagesOutput?: string;
  jsonEnabled?: boolean;
  jsonOutput?: string;
  htmlEnabled?: boolean;
  htmlOutput?: string;
  filterSpecs?: boolean;
  omitFiltered?: boolean;
}

export interface IUserConfiguration {
  readonly stepDefinitions?: string | string[];
  readonly messages?: {
    enabled: boolean;
    output?: string;
  };
  readonly json?: {
    enabled: boolean;
    output?: string;
  };
  readonly html?: {
    enabled: boolean;
    output?: string;
  };
  readonly filterSpecs?: boolean;
  readonly omitFiltered?: boolean;
}

export interface IPreprocessorConfiguration {
  readonly stepDefinitions: string | string[];
  readonly messages: {
    enabled: boolean;
    output: string;
  };
  readonly json: {
    enabled: boolean;
    output: string;
  };
  readonly html: {
    enabled: boolean;
    output: string;
  };
  readonly filterSpecs: boolean;
  readonly omitFiltered: boolean;
  readonly implicitIntegrationFolder: string;
}

const DEFAULT_STEP_DEFINITIONS = [
  "[integration-directory]/[filepath]/**/*.{js,mjs,ts,tsx}",
  "[integration-directory]/[filepath].{js,mjs,ts,tsx}",
  "cypress/support/step_definitions/**/*.{js,mjs,ts,tsx}",
];

export function combineIntoConfiguration(
  configuration: IUserConfiguration,
  overrides: IEnvironmentOverrides,
  cypress: ICypressConfiguration,
  implicitIntegrationFolder: string
): IPreprocessorConfiguration {
  const defaultStepDefinitions = DEFAULT_STEP_DEFINITIONS.map((pattern) =>
    pattern.replace(
      "[integration-directory]",
      ensureIsRelative(
        cypress.projectRoot,
        "integrationFolder" in cypress
          ? cypress.integrationFolder
          : implicitIntegrationFolder
      )
    )
  );

  const stepDefinitions: IPreprocessorConfiguration["stepDefinitions"] =
    overrides.stepDefinitions ??
    configuration.stepDefinitions ??
    defaultStepDefinitions;

  const json: IPreprocessorConfiguration["json"] = {
    enabled: overrides.jsonEnabled ?? configuration.json?.enabled ?? false,
    output:
      overrides.jsonOutput ??
      (configuration.json?.output || "cucumber-report.json"),
  };

  const html: IPreprocessorConfiguration["html"] = {
    enabled: overrides.htmlEnabled ?? configuration.html?.enabled ?? false,
    output:
      overrides.htmlOutput ??
      (configuration.html?.output || "cucumber-report.html"),
  };

  const messages: IPreprocessorConfiguration["messages"] = {
    enabled:
      json.enabled ||
      html.enabled ||
      (overrides.messagesEnabled ?? configuration.messages?.enabled ?? false),
    output:
      overrides.messagesOutput ??
      (configuration.messages?.output || "cucumber-messages.ndjson"),
  };

  const filterSpecs: IPreprocessorConfiguration["filterSpecs"] =
    overrides.filterSpecs ?? configuration.filterSpecs ?? false;

  const omitFiltered: IPreprocessorConfiguration["omitFiltered"] =
    overrides.omitFiltered ?? configuration.omitFiltered ?? false;

  return {
    stepDefinitions,
    messages,
    json,
    html,
    filterSpecs,
    omitFiltered,
    implicitIntegrationFolder,
  };
}

async function cosmiconfigResolver(projectRoot: string) {
  const result = await cosmiconfig("cypress-cucumber-preprocessor").search(
    projectRoot
  );

  return result?.config;
}

export type ConfigurationFileResolver = (
  projectRoot: string
) => unknown | Promise<unknown>;

export async function resolve(
  cypressConfig: ICypressConfiguration,
  environment: Record<string, unknown>,
  implicitIntegrationFolder: string,
  configurationFileResolver: ConfigurationFileResolver = cosmiconfigResolver
): Promise<IPreprocessorConfiguration> {
  const result = await configurationFileResolver(cypressConfig.projectRoot);

  const environmentOverrides = validateEnvironmentOverrides(environment);

  debug(`resolved environment overrides ${util.inspect(environmentOverrides)}`);

  let explicitConfiguration: Partial<IUserConfiguration>;

  if (result) {
    if (typeof result !== "object" || result == null) {
      throw new Error(
        `Malformed configuration, expected an object, but got ${util.inspect(
          result
        )}`
      );
    }

    explicitConfiguration = Object.assign(
      {},
      ...Object.entries(result).map((entry) =>
        validateUserConfigurationEntry(...entry)
      )
    );

    debug(
      `resolved explicit user configuration ${util.inspect(
        explicitConfiguration
      )}`
    );
  } else {
    explicitConfiguration = {};

    debug("resolved no explicit user configuration");
  }

  const configuration = combineIntoConfiguration(
    explicitConfiguration,
    environmentOverrides,
    cypressConfig,
    implicitIntegrationFolder
  );

  debug(`resolved configuration ${util.inspect(configuration)}`);

  return configuration;
}
