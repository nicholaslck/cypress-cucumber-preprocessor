import {
  CucumberExpression,
  RegularExpression,
  Expression,
  ParameterTypeRegistry,
  ParameterType,
} from "@cucumber/cucumber-expressions";

import parse from "@cucumber/tag-expressions";

import { IdGenerator } from "@cucumber/messages";

import { assertAndReturn } from "./helpers/assertions";

import DataTable from "./data_table";

import { CypressCucumberError } from "./helpers/error";

import {
  IHookBody,
  IStepHookBody,
  IStepHookParameter,
  IParameterTypeDefinition,
  IStepDefinitionBody,
} from "./public-member-types";

import {
  maybeRetrievePositionFromSourceMap,
  Position,
} from "./helpers/source-map";

export interface IStepDefinition<T extends unknown[], C extends Mocha.Context> {
  id: string;
  expression: Expression;
  implementation: IStepDefinitionBody<T, C>;
  position?: Position;
}

export class MissingDefinitionError extends CypressCucumberError {}

export class MultipleDefinitionsError extends CypressCucumberError {}

export type ScenarioHookKeyword = "Before" | "After";

export type StepHookKeyword = "BeforeStep" | "AfterStep";

interface IBaseHook<Implementation, Keyword> {
  tags?: string;
  node: ReturnType<typeof parse>;
  implementation: Implementation;
  keyword: Keyword;
  position?: Position;
}

export interface IHook extends IBaseHook<IHookBody, ScenarioHookKeyword> {
  id: string;
}

export type IStepHook = IBaseHook<IStepHookBody, StepHookKeyword>;

const noopNode = { evaluate: () => true };

function parseHookArguments<Implementation, Keyword>(
  options: { tags?: string },
  fn: Implementation,
  keyword: Keyword,
  position?: Position
): IBaseHook<Implementation, Keyword> {
  return {
    tags: options.tags,
    node: options.tags ? parse(options.tags) : noopNode,
    implementation: fn,
    keyword,
    position,
  };
}

export class Registry {
  public parameterTypeRegistry: ParameterTypeRegistry;

  private preliminaryStepDefinitions: {
    description: string | RegExp;
    implementation: () => void;
    position?: Position;
  }[] = [];

  public stepDefinitions: IStepDefinition<unknown[], Mocha.Context>[] = [];

  private preliminaryHooks: Omit<IHook, "id">[] = [];

  public hooks: IHook[] = [];

  public stepHooks: IStepHook[] = [];

  constructor(private experimentalSourceMap: boolean) {
    this.defineStep = this.defineStep.bind(this);
    this.runStepDefininition = this.runStepDefininition.bind(this);
    this.defineParameterType = this.defineParameterType.bind(this);
    this.defineBefore = this.defineBefore.bind(this);
    this.defineAfter = this.defineAfter.bind(this);

    this.parameterTypeRegistry = new ParameterTypeRegistry();
  }

  public finalize(newId: IdGenerator.NewId) {
    for (const { description, implementation, position } of this
      .preliminaryStepDefinitions) {
      if (typeof description === "string") {
        this.stepDefinitions.push({
          id: newId(),
          expression: new CucumberExpression(
            description,
            this.parameterTypeRegistry
          ),
          implementation,
          position,
        });
      } else {
        this.stepDefinitions.push({
          id: newId(),
          expression: new RegularExpression(
            description,
            this.parameterTypeRegistry
          ),
          implementation,
          position,
        });
      }
    }

    for (const preliminaryHook of this.preliminaryHooks) {
      this.hooks.push({
        id: newId(),
        ...preliminaryHook,
      });
    }
  }

  public defineStep(description: string | RegExp, implementation: () => void) {
    if (typeof description !== "string" && !(description instanceof RegExp)) {
      throw new Error("Unexpected argument for step definition");
    }

    this.preliminaryStepDefinitions.push({
      description,
      implementation,
      position: maybeRetrievePositionFromSourceMap(this.experimentalSourceMap),
    });
  }

  public defineParameterType<T, C extends Mocha.Context>({
    name,
    regexp,
    transformer,
  }: IParameterTypeDefinition<T, C>) {
    this.parameterTypeRegistry.defineParameterType(
      new ParameterType(name, regexp, null, transformer, true, false)
    );
  }

  public defineHook(
    keyword: ScenarioHookKeyword,
    options: { tags?: string },
    fn: IHookBody
  ) {
    this.preliminaryHooks.push(
      parseHookArguments(
        options,
        fn,
        keyword,
        maybeRetrievePositionFromSourceMap(this.experimentalSourceMap)
      )
    );
  }

  public defineBefore(options: { tags?: string }, fn: IHookBody) {
    this.defineHook("Before", options, fn);
  }

  public defineAfter(options: { tags?: string }, fn: IHookBody) {
    this.defineHook("After", options, fn);
  }

  public defineStepHook(
    keyword: StepHookKeyword,
    options: { tags?: string },
    fn: IStepHookBody
  ) {
    this.stepHooks.push(
      parseHookArguments(
        options,
        fn,
        keyword,
        maybeRetrievePositionFromSourceMap(this.experimentalSourceMap)
      )
    );
  }

  public defineBeforeStep(options: { tags?: string }, fn: IStepHookBody) {
    this.defineStepHook("BeforeStep", options, fn);
  }

  public defineAfterStep(options: { tags?: string }, fn: IStepHookBody) {
    this.defineStepHook("AfterStep", options, fn);
  }

  public getMatchingStepDefinitions(text: string) {
    return this.stepDefinitions.filter((stepDefinition) =>
      stepDefinition.expression.match(text)
    );
  }

  public resolveStepDefintion(text: string) {
    const matchingStepDefinitions = this.getMatchingStepDefinitions(text);

    if (matchingStepDefinitions.length === 0) {
      throw new MissingDefinitionError(
        `Step implementation missing for: ${text}`
      );
    } else if (matchingStepDefinitions.length > 1) {
      throw new MultipleDefinitionsError(
        `Multiple matching step definitions for: ${text}\n` +
          matchingStepDefinitions
            .map((stepDefinition) => {
              const { expression } = stepDefinition;

              const stringExpression =
                expression instanceof RegularExpression
                  ? String(expression.regexp)
                  : expression.source;

              if (stepDefinition.position) {
                return ` ${stringExpression} - ${stepDefinition.position.source}:${stepDefinition.position.line}`;
              } else {
                return ` ${stringExpression}`;
              }
            })
            .join("\n")
      );
    } else {
      return matchingStepDefinitions[0];
    }
  }

  public runStepDefininition(
    world: Mocha.Context,
    text: string,
    argument?: DataTable | string
  ): unknown {
    const stepDefinition = this.resolveStepDefintion(text);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const args = stepDefinition.expression
      .match(text)!
      .map((match) => match.getValue(world));

    if (argument) {
      args.push(argument);
    }

    return stepDefinition.implementation.apply(world, args);
  }

  public resolveHooks(keyword: ScenarioHookKeyword, tags: string[]) {
    return this.hooks.filter(
      (hook) => hook.keyword === keyword && hook.node.evaluate(tags)
    );
  }

  public resolveBeforeHooks(tags: string[]) {
    return this.resolveHooks("Before", tags);
  }

  public resolveAfterHooks(tags: string[]) {
    return this.resolveHooks("After", tags);
  }

  public runHook(world: Mocha.Context, hook: IHook) {
    return hook.implementation.call(world);
  }

  public resolveStepHooks(keyword: StepHookKeyword, tags: string[]) {
    return this.stepHooks.filter(
      (hook) => hook.keyword === keyword && hook.node.evaluate(tags)
    );
  }

  public resolveBeforeStepHooks(tags: string[]) {
    return this.resolveStepHooks("BeforeStep", tags);
  }

  public resolveAfterStepHooks(tags: string[]) {
    return this.resolveStepHooks("AfterStep", tags);
  }

  public runStepHook(
    world: Mocha.Context,
    hook: IStepHook,
    options: IStepHookParameter
  ) {
    return hook.implementation.call(world, options);
  }
}

const globalPropertyName =
  "__cypress_cucumber_preprocessor_registry_dont_use_this";

export function withRegistry(
  experimentalSourceMap: boolean,
  fn: () => void
): Registry {
  const registry = new Registry(experimentalSourceMap);
  assignRegistry(registry);
  fn();
  freeRegistry();
  return registry;
}

export function assignRegistry(registry: Registry) {
  globalThis[globalPropertyName] = registry;
}

export function freeRegistry() {
  delete globalThis[globalPropertyName];
}

export function getRegistry(): Registry {
  return assertAndReturn(
    globalThis[globalPropertyName],
    "Expected to find a global registry (this usually means you are trying to define steps or hooks in support/e2e.js, which is not supported)"
  );
}
