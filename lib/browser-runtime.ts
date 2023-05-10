import * as messages from "@cucumber/messages";

import parse from "@cucumber/tag-expressions";

import {
  CucumberExpressionGenerator,
  ParameterTypeRegistry,
  RegularExpression,
} from "@cucumber/cucumber-expressions";

import { v4 as uuid } from "uuid";

import { assertAndReturn, fail } from "./helpers/assertions";

import DataTable from "./data_table";

import {
  assignRegistry,
  freeRegistry,
  IHook,
  MissingDefinitionError,
  Registry,
} from "./registry";

import {
  collectTagNames,
  createAstIdMap,
  traverseGherkinDocument,
} from "./helpers/ast";

import {
  HOOK_FAILURE_EXPR,
  INTERNAL_SPEC_PROPERTIES,
  INTERNAL_SUITE_PROPERTIES,
} from "./constants";

import {
  ITaskSpecEnvelopes,
  ITaskTestCaseStarted,
  ITaskTestCaseFinished,
  ITaskTestStepStarted,
  ITaskTestStepFinished,
  TASK_SPEC_ENVELOPES,
  TASK_TEST_CASE_STARTED,
  TASK_TEST_CASE_FINISHED,
  TASK_TEST_STEP_STARTED,
  TASK_TEST_STEP_FINISHED,
} from "./cypress-task-definitions";

import { notNull } from "./helpers/type-guards";

import { looksLikeOptions, tagToCypressOptions } from "./helpers/tag-parser";

import { createTimestamp, duration } from "./helpers/messages";

import { indent, stripIndent } from "./helpers/strings";

import { generateSnippet } from "./helpers/snippets";

import { runStepWithLogGroup } from "./helpers/cypress";

import { getTags } from "./helpers/environment";

type Node = ReturnType<typeof parse>;

interface CompositionContext {
  registry: Registry;
  gherkinDocument: messages.GherkinDocument;
  astIdsMap: ReturnType<typeof createAstIdMap>;
  pickles: messages.Pickle[];
  specEnvelopes: messages.Envelope[];
  testFilter: Node;
  omitFiltered: boolean;
  messagesEnabled: boolean;
  stepDefinitionHints: {
    stepDefinitions: string | string[];
    stepDefinitionPatterns: string[];
    stepDefinitionPaths: string[];
  };
}

const sourceReference: messages.SourceReference = {
  uri: "not available",
  location: { line: 0 },
};

interface IStep {
  hook?: IHook;
  pickleStep?: messages.PickleStep;
}

export interface InternalSpecProperties {
  pickle: messages.Pickle;
  testCaseStartedId: string;
  currentStep?: IStep;
  allSteps: IStep[];
  remainingSteps: IStep[];
}

export interface InternalSuiteProperties {
  isEventHandlersAttached?: boolean;
}

let specId = 0;

const internalSpecProperties = new Map<number, InternalSpecProperties>();

function createInternalSpecProperties(
  properties: InternalSpecProperties
): number {
  internalSpecProperties.set(++specId, properties);
  return specId;
}

export function retrieveInternalSpecProperties(): InternalSpecProperties {
  const reference = Cypress.env(INTERNAL_SPEC_PROPERTIES) as number;

  return assertAndReturn(
    internalSpecProperties.get(reference),
    `Expected to find internal spec properties with reference = ${reference}`
  );
}

function updateInternalSpecProperties(
  newProperties: Partial<InternalSpecProperties>
): void {
  Object.assign(retrieveInternalSpecProperties(), newProperties);
}

function retrieveInternalSuiteProperties():
  | InternalSuiteProperties
  | undefined {
  return Cypress.env(INTERNAL_SUITE_PROPERTIES);
}

function taskSpecEnvelopes(messages: messages.Envelope[]) {
  cy.task(TASK_SPEC_ENVELOPES, { messages } as ITaskSpecEnvelopes, {
    log: false,
  });
}

function taskTestCaseStarted(testCaseStarted: messages.TestCaseStarted) {
  cy.task(TASK_TEST_CASE_STARTED, testCaseStarted as ITaskTestCaseStarted, {
    log: false,
  });
}

function taskTestCaseFinished(testCasefinished: messages.TestCaseFinished) {
  cy.task(TASK_TEST_CASE_FINISHED, testCasefinished as ITaskTestCaseFinished, {
    log: false,
  });
}

function taskTestStepStarted(testStepStarted: messages.TestStepStarted) {
  cy.task(TASK_TEST_STEP_STARTED, testStepStarted as ITaskTestStepStarted, {
    log: false,
  });
}

function taskTestStepFinished(testStepfinished: messages.TestStepFinished) {
  cy.task(TASK_TEST_STEP_FINISHED, testStepfinished as ITaskTestStepFinished, {
    log: false,
  });
}

function findPickleById(context: CompositionContext, astId: string) {
  return assertAndReturn(
    context.pickles.find(
      (pickle) => pickle.astNodeIds && pickle.astNodeIds.includes(astId)
    ),
    `Expected to find a pickle associated with id = ${astId}`
  );
}

function collectExampleIds(examples: readonly messages.Examples[]) {
  return examples
    .map((examples) => {
      return assertAndReturn(
        examples.tableBody,
        "Expected to find a table body"
      ).map((row) =>
        assertAndReturn(row.id, "Expected table row to have an id")
      );
    })
    .reduce((acum, el) => acum.concat(el), []);
}

function createFeature(context: CompositionContext, feature: messages.Feature) {
  describe(feature.name || "<unamed feature>", () => {
    before(function () {
      beforeHandler.call(this, context);
    });

    beforeEach(function () {
      beforeEachHandler.call(this, context);
    });

    afterEach(function () {
      afterEachHandler.call(this, context);
    });

    if (feature.children) {
      for (const child of feature.children) {
        if (child.scenario) {
          createScenario(context, child.scenario);
        } else if (child.rule) {
          createRule(context, child.rule);
        }
      }
    }
  });
}

function createRule(context: CompositionContext, rule: messages.Rule) {
  const picklesWithinRule = rule.children
    ?.map((child) => child.scenario)
    .filter(notNull)
    .flatMap((scenario) => {
      if (scenario.examples.length > 0) {
        return collectExampleIds(scenario.examples).map((exampleId) => {
          return findPickleById(context, exampleId);
        });
      } else {
        const scenarioId = assertAndReturn(
          scenario.id,
          "Expected scenario to have an id"
        );

        return findPickleById(context, scenarioId);
      }
    });

  if (picklesWithinRule) {
    if (context.omitFiltered) {
      const matches = picklesWithinRule.filter((pickle) =>
        context.testFilter.evaluate(collectTagNames(pickle.tags))
      );

      if (matches.length === 0) {
        return;
      }
    }
  }

  describe(rule.name || "<unamed rule>", () => {
    if (rule.children) {
      for (const child of rule.children) {
        if (child.scenario) {
          createScenario(context, child.scenario);
        }
      }
    }
  });
}
function createScenario(
  context: CompositionContext,
  scenario: messages.Scenario
) {
  if (scenario.examples.length > 0) {
    const exampleIds = collectExampleIds(scenario.examples);

    for (let i = 0; i < exampleIds.length; i++) {
      const exampleId = exampleIds[i];
      const pickle = findPickleById(context, exampleId);
      const baseName = pickle.name || "<unamed scenario>";
      const exampleName = `${baseName} (example #${i + 1})`;

      createPickle(context, { ...pickle, name: exampleName });
    }
  } else {
    const scenarioId = assertAndReturn(
      scenario.id,
      "Expected scenario to have an id"
    );

    const pickle = findPickleById(context, scenarioId);

    createPickle(context, pickle);
  }
}

function createPickle(context: CompositionContext, pickle: messages.Pickle) {
  const { registry, gherkinDocument, pickles, testFilter } = context;
  const testCaseId = pickle.id;
  const pickleSteps = pickle.steps ?? [];
  const scenarioName = pickle.name || "<unamed scenario>";
  const tags = collectTagNames(pickle.tags);
  const beforeHooks = registry.resolveBeforeHooks(tags);
  const afterHooks = registry.resolveAfterHooks(tags);

  const steps: IStep[] = [
    ...beforeHooks.map((hook) => ({ hook })),
    ...pickleSteps.map((pickleStep) => ({ pickleStep })),
    ...afterHooks.map((hook) => ({ hook })),
  ];

  if (!testFilter.evaluate(tags) || tags.includes("@skip")) {
    if (!context.omitFiltered) {
      it.skip(scenarioName);
    }

    return;
  }

  let attempt = 0;

  const internalProperties: InternalSpecProperties = {
    pickle,
    testCaseStartedId: uuid(),
    allSteps: steps,
    remainingSteps: [...steps],
  };

  const internalEnv = {
    [INTERNAL_SPEC_PROPERTIES]:
      createInternalSpecProperties(internalProperties),
  };

  const suiteOptions = tags
    .filter(looksLikeOptions)
    .map(tagToCypressOptions)
    .reduce(Object.assign, {});

  if (suiteOptions.env) {
    Object.assign(suiteOptions.env, internalEnv);
  } else {
    suiteOptions.env = internalEnv;
  }

  it(scenarioName, suiteOptions, function () {
    const { remainingSteps, testCaseStartedId } =
      retrieveInternalSpecProperties();

    if (context.messagesEnabled) {
      taskTestCaseStarted({
        id: testCaseStartedId,
        testCaseId,
        attempt: attempt++,
        timestamp: createTimestamp(),
      });
    }

    window.testState = {
      gherkinDocument,
      pickles,
      pickle,
    };

    for (const step of steps) {
      if (step.hook) {
        const hook = step.hook;

        cy.then(() => {
          delete window.testState.pickleStep;

          const start = createTimestamp();

          if (context.messagesEnabled) {
            taskTestStepStarted({
              testStepId: hook.id,
              testCaseStartedId,
              timestamp: start,
            });
          }

          return cy.wrap(start, { log: false });
        })
          .then((start) => {
            runStepWithLogGroup({
              fn: () => registry.runHook(this, hook),
              keyword: hook.keyword,
              text: hook.tags,
            });

            return cy.wrap(start, { log: false });
          })
          .then((start) => {
            const end = createTimestamp();

            if (context.messagesEnabled) {
              taskTestStepFinished({
                testStepId: hook.id,
                testCaseStartedId,
                testStepResult: {
                  status: messages.TestStepResultStatus.PASSED,
                  duration: duration(start, end),
                },
                timestamp: end,
              });
            }

            remainingSteps.shift();
          });
      } else if (step.pickleStep) {
        const pickleStep = step.pickleStep;

        const text = assertAndReturn(
          pickleStep.text,
          "Expected pickle step to have a text"
        );

        const scenarioStep = assertAndReturn(
          context.astIdsMap.get(
            assertAndReturn(
              pickleStep.astNodeIds?.[0],
              "Expected to find at least one astNodeId"
            )
          ),
          `Expected to find scenario step associated with id = ${pickleStep.astNodeIds?.[0]}`
        );

        const argument: DataTable | string | undefined = pickleStep.argument
          ?.dataTable
          ? new DataTable(pickleStep.argument.dataTable)
          : pickleStep.argument?.docString?.content
          ? pickleStep.argument.docString.content
          : undefined;

        cy.then(() => {
          window.testState.pickleStep = step.pickleStep;

          internalProperties.currentStep = { pickleStep };

          const start = createTimestamp();

          if (context.messagesEnabled) {
            taskTestStepStarted({
              testStepId: pickleStep.id,
              testCaseStartedId,
              timestamp: start,
            });
          }

          return cy.wrap(start, { log: false });
        })
          .then((start) => {
            try {
              return runStepWithLogGroup({
                keyword: assertAndReturn(
                  "keyword" in scenarioStep && scenarioStep.keyword,
                  "Expected to find a keyword in the scenario step"
                ),
                argument,
                text,
                fn: () => registry.runStepDefininition(this, text, argument),
              }).then((result) => {
                return {
                  start,
                  result,
                };
              });
            } catch (e) {
              if (e instanceof MissingDefinitionError) {
                throw new Error(
                  createMissingStepDefinitionMessage(
                    context,
                    pickleStep,
                    context.registry.parameterTypeRegistry
                  )
                );
              } else {
                throw e;
              }
            }
          })
          .then(({ start, result }) => {
            const end = createTimestamp();

            if (result === "pending") {
              if (context.messagesEnabled) {
                taskTestStepFinished({
                  testStepId: pickleStep.id,
                  testCaseStartedId,
                  testStepResult: {
                    status: messages.TestStepResultStatus.PENDING,
                    duration: duration(start, end),
                  },
                  timestamp: end,
                });

                remainingSteps.shift();

                for (const skippedStep of remainingSteps) {
                  const testStepId = assertAndReturn(
                    skippedStep.hook?.id ?? skippedStep.pickleStep?.id,
                    "Expected a step to either be a hook or a pickleStep"
                  );

                  taskTestStepStarted({
                    testStepId,
                    testCaseStartedId,
                    timestamp: createTimestamp(),
                  });

                  taskTestStepFinished({
                    testStepId,
                    testCaseStartedId,
                    testStepResult: {
                      status: messages.TestStepResultStatus.SKIPPED,
                      duration: {
                        seconds: 0,
                        nanos: 0,
                      },
                    },
                    timestamp: createTimestamp(),
                  });
                }
              }

              for (let i = 0, count = remainingSteps.length; i < count; i++) {
                remainingSteps.pop();
              }

              cy.then(() => this.skip());
            } else {
              if (context.messagesEnabled) {
                taskTestStepFinished({
                  testStepId: pickleStep.id,
                  testCaseStartedId,
                  testStepResult: {
                    status: messages.TestStepResultStatus.PASSED,
                    duration: duration(start, end),
                  },
                  timestamp: end,
                });
              }

              remainingSteps.shift();
            }
          });
      }
    }
  });
}

function collectTagNamesFromGherkinDocument(
  gherkinDocument: messages.GherkinDocument
) {
  const tagNames: string[] = [];

  for (const node of traverseGherkinDocument(gherkinDocument)) {
    if ("tags" in node) {
      tagNames.push(...collectTagNames(node.tags));
    }
  }

  return tagNames;
}

function createTestFilter(
  gherkinDocument: messages.GherkinDocument,
  environment: Cypress.ObjectLike
): Node {
  const tagsInDocument = collectTagNamesFromGherkinDocument(gherkinDocument);

  if (tagsInDocument.includes("@only") || tagsInDocument.includes("@focus")) {
    return parse("@only or @focus");
  } else {
    const tags = getTags(environment);

    return tags ? parse(tags) : { evaluate: () => true };
  }
}

function beforeHandler(context: CompositionContext) {
  if (!retrieveInternalSuiteProperties()?.isEventHandlersAttached) {
    fail(
      "Missing preprocessor event handlers (this usally means you've not invoked `addCucumberPreprocessorPlugin()` or not returned the config object in `setupNodeEvents()`)"
    );
  }

  if (context.messagesEnabled) {
    taskSpecEnvelopes(context.specEnvelopes);
  }
}

function beforeEachHandler(context: CompositionContext) {
  assignRegistry(context.registry);
}

function afterEachHandler(this: Mocha.Context, context: CompositionContext) {
  freeRegistry();

  const properties = retrieveInternalSpecProperties();

  const { testCaseStartedId, remainingSteps } = properties;

  if (context.messagesEnabled) {
    const endTimestamp = createTimestamp();

    if (remainingSteps.length > 0) {
      if (this.currentTest?.state === "failed") {
        const error = assertAndReturn(
          this.currentTest?.err?.message,
          "Expected to find an error message"
        );

        if (HOOK_FAILURE_EXPR.test(error)) {
          return;
        }

        const failedStep = assertAndReturn(
          remainingSteps.shift(),
          "Expected there to be a remaining step"
        );

        const testStepId = assertAndReturn(
          failedStep.hook?.id ?? failedStep.pickleStep?.id,
          "Expected a step to either be a hook or a pickleStep"
        );

        const failedTestStepFinished: messages.TestStepFinished =
          error.includes("Step implementation missing")
            ? {
                testStepId,
                testCaseStartedId,
                testStepResult: {
                  status: messages.TestStepResultStatus.UNDEFINED,
                  duration: {
                    seconds: 0,
                    nanos: 0,
                  },
                },
                timestamp: endTimestamp,
              }
            : {
                testStepId,
                testCaseStartedId,
                testStepResult: {
                  status: messages.TestStepResultStatus.FAILED,
                  message: this.currentTest?.err?.message,
                  // TODO: Create a proper duration from when the step started.
                  duration: {
                    seconds: 0,
                    nanos: 0,
                  },
                },
                timestamp: endTimestamp,
              };

        taskTestStepFinished(failedTestStepFinished);

        for (const skippedStep of remainingSteps) {
          const testStepId = assertAndReturn(
            skippedStep.hook?.id ?? skippedStep.pickleStep?.id,
            "Expected a step to either be a hook or a pickleStep"
          );

          taskTestStepStarted({
            testStepId,
            testCaseStartedId,
            timestamp: endTimestamp,
          });

          taskTestStepFinished({
            testStepId,
            testCaseStartedId,
            testStepResult: {
              status: messages.TestStepResultStatus.SKIPPED,
              duration: {
                seconds: 0,
                nanos: 0,
              },
            },
            timestamp: endTimestamp,
          });
        }
      } else {
        for (const skippedStep of remainingSteps) {
          const testStepId = assertAndReturn(
            skippedStep.hook?.id ?? skippedStep.pickleStep?.id,
            "Expected a step to either be a hook or a pickleStep"
          );

          taskTestStepStarted({
            testStepId,
            testCaseStartedId,
            timestamp: endTimestamp,
          });

          taskTestStepFinished({
            testStepId,
            testCaseStartedId,
            testStepResult: {
              status: messages.TestStepResultStatus.UNKNOWN,
              duration: {
                seconds: 0,
                nanos: 0,
              },
            },
            timestamp: endTimestamp,
          });
        }
      }
    }

    const currentRetry = assertAndReturn(
      (this.currentTest as any)?._currentRetry,
      "Expected to find an attribute _currentRetry"
    );

    const retries = assertAndReturn(
      (this.currentTest as any)?._retries,
      "Expected to find an attribute _retries"
    );

    const willBeRetried =
      this.currentTest?.state === "failed" ? currentRetry < retries : false;

    taskTestCaseFinished({
      testCaseStartedId,
      timestamp: endTimestamp,
      willBeRetried,
    });
  }

  /**
   * Repopulate internal properties in case previous test is retried.
   */
  updateInternalSpecProperties({
    testCaseStartedId: uuid(),
    remainingSteps: [...properties.allSteps],
  });
}

export default function createTests(
  registry: Registry,
  source: string,
  gherkinDocument: messages.GherkinDocument,
  pickles: messages.Pickle[],
  messagesEnabled: boolean,
  omitFiltered: boolean,
  stepDefinitionHints: {
    stepDefinitions: string | string[];
    stepDefinitionPatterns: string[];
    stepDefinitionPaths: string[];
  }
) {
  const stepDefinitions: messages.StepDefinition[] =
    registry.stepDefinitions.map((stepDefinition) => {
      const type: messages.StepDefinitionPatternType =
        stepDefinition.expression instanceof RegularExpression
          ? messages.StepDefinitionPatternType.REGULAR_EXPRESSION
          : messages.StepDefinitionPatternType.CUCUMBER_EXPRESSION;

      return {
        id: stepDefinition.id,
        pattern: {
          type,
          source: stepDefinition.expression.source,
        },
        sourceReference,
      };
    });

  const testCases: messages.TestCase[] = pickles.map((pickle) => {
    const tags = collectTagNames(pickle.tags);
    const beforeHooks = registry.resolveBeforeHooks(tags);
    const afterHooks = registry.resolveAfterHooks(tags);

    const hooksToStep = (hook: IHook): messages.TestStep => {
      return {
        id: hook.id,
        hookId: hook.id,
      };
    };

    const pickleStepToTestStep = (
      pickleStep: messages.PickleStep
    ): messages.TestStep => {
      const stepDefinitionIds = registry
        .getMatchingStepDefinitions(pickleStep.text)
        .map((stepDefinition) => stepDefinition.id);

      return {
        id: pickleStep.id,
        pickleStepId: pickleStep.id,
        stepDefinitionIds,
      };
    };

    return {
      id: pickle.id,
      pickleId: pickle.id,
      testSteps: [
        ...beforeHooks.map(hooksToStep),
        ...pickle.steps.map(pickleStepToTestStep),
        ...afterHooks.map(hooksToStep),
      ],
    };
  });

  const specEnvelopes: messages.Envelope[] = [];

  specEnvelopes.push({
    source: {
      data: source,
      uri: assertAndReturn(
        gherkinDocument.uri,
        "Expected gherkin document to have URI"
      ),
      mediaType:
        "text/x.cucumber.gherkin+plain" as messages.SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,
    },
  });

  specEnvelopes.push({
    gherkinDocument,
  });

  for (const pickle of pickles) {
    specEnvelopes.push({
      pickle,
    });
  }

  for (const hook of [...registry.beforeHooks, ...registry.afterHooks]) {
    specEnvelopes.push({
      hook: {
        id: hook.id,
        sourceReference,
      },
    });
  }

  for (const stepDefinition of stepDefinitions) {
    specEnvelopes.push({
      stepDefinition,
    });
  }

  for (const testCase of testCases) {
    specEnvelopes.push({
      testCase,
    });
  }

  const testFilter = createTestFilter(gherkinDocument, Cypress.env());

  const context: CompositionContext = {
    registry,
    gherkinDocument,
    astIdsMap: createAstIdMap(gherkinDocument),
    pickles,
    specEnvelopes,
    testFilter,
    omitFiltered,
    messagesEnabled,
    stepDefinitionHints,
  };

  if (gherkinDocument.feature) {
    createFeature(context, gherkinDocument.feature);
  }
}

type Tail<T extends any[]> = T extends [infer _A, ...infer R] ? R : never;

export type CreateTestsOptions = Tail<Parameters<typeof createTests>>;

function strictIsInteractive(): boolean {
  const isInteractive = Cypress.config(
    "isInteractive" as keyof Cypress.ConfigOptions
  );

  if (typeof isInteractive === "boolean") {
    return isInteractive;
  }

  throw new Error(
    "Expected to find a Cypress configuration property `isInteractive`, but didn't"
  );
}

function createMissingStepDefinitionMessage(
  context: CompositionContext,
  pickleStep: messages.PickleStep,
  parameterTypeRegistry: ParameterTypeRegistry
) {
  const noStepDefinitionPathsTemplate = `
    Step implementation missing for "<text>".

    We tried searching for files containing step definitions using the following search pattern templates:

    <step-definitions>

    These templates resolved to the following search patterns:

    <step-definition-patterns>

    These patterns matched **no files** containing step definitions. This almost certainly means that you have misconfigured \`stepDefinitions\`.

    You can implement it using the suggestion(s) below.

    <snippets>
  `;

  const someStepDefinitionPathsTemplate = `
    Step implementation missing for "<text>".

    We tried searching for files containing step definitions using the following search pattern templates:

    <step-definitions>

    These templates resolved to the following search patterns:

    <step-definition-patterns>

    These patterns matched the following files:

    <step-definition-paths>

    However, none of these files contained a step definition matching "<text>".

    You can implement it using the suggestion(s) below.

    <snippets>
  `;

  const { stepDefinitionHints } = context;

  const template =
    stepDefinitionHints.stepDefinitionPaths.length > 0
      ? someStepDefinitionPathsTemplate
      : noStepDefinitionPathsTemplate;

  const maybeEscape = (string: string) =>
    strictIsInteractive() ? string.replace("*", "\\*") : string;

  const prettyPrintList = (items: string[]) =>
    items.map((item) => "  - " + maybeEscape(item)).join("\n");

  let parameter: "dataTable" | "docString" | null = null;

  if (pickleStep.argument?.dataTable) {
    parameter = "dataTable";
  } else if (pickleStep.argument?.docString) {
    parameter = "docString";
  }

  const snippets = new CucumberExpressionGenerator(
    () => parameterTypeRegistry.parameterTypes
  )
    .generateExpressions(pickleStep.text)
    .map((expression) =>
      generateSnippet(
        expression,
        assertAndReturn(pickleStep.type, "Expected pickleStep to have a type"),
        parameter
      )
    )
    .map((snippet) => indent(snippet, { count: 2 }))
    .join("\n\n");

  return stripIndent(template)
    .replaceAll("<text>", pickleStep.text)
    .replaceAll(
      "<step-definitions>",
      prettyPrintList([stepDefinitionHints.stepDefinitions].flat())
    )
    .replaceAll(
      "<step-definition-patterns>",
      prettyPrintList(stepDefinitionHints.stepDefinitionPatterns)
    )
    .replaceAll(
      "<step-definition-paths>",
      prettyPrintList(stepDefinitionHints.stepDefinitionPaths)
    )
    .replaceAll("<snippets>", snippets);
}
