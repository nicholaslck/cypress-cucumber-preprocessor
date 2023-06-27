[← Back to documentation](readme.md)

# Frequently asked questions

* Node requirements
  * [I get `fs_1.promises.rm is not a function`](#i-get-fs_1promisesrm-is-not-a-function)
  * [I get `state.messages.findLastIndex is not a function`](#i-get-statemessagesfindlastindex-is-not-a-function)
* Cypress oddities
  * [`--env` / `tags` isn't picked up](#--env--tags-isnt-picked-up)
  * [Negated tags / complex tag expressions aren't working as expected](#negated-tags--complex-tag-expressions-arent-working-as-expected)
  * [JSON reports aren't generated in open / interactive mode](#json-reports-arent-generated-in-open--interactive-mode)
* TypeScript related
  * [I get `cypress_esbuild_preprocessor_1.createBundler is not a function`](#i-get-cypress_esbuild_preprocessor_1createbundler-is-not-a-function)
  * [I get `cypress_esbuild_preprocessor_1.default is not a function`](#i-get-cypress_esbuild_preprocessor_1default-is-not-a-function)
  * [I get `Cannot find module '@badeball/cypress-cucumber-preprocessor/esbuild'`](#i-get-cannot-find-module-badeballcypress-cucumber-preprocessoresbuild)
* On event handlers
  * [My JSON report isn't generated](#my-json-report-isnt-generated)
  * [I get `Unexpected state in <state-handler>: <state>`](#i-get-unexpected-state-in-state-handler-state)
* Feature deprecations
  * [Why is `cypress-tags` missing?](#why-is-cypress-tags-missing)
  * [The members `And(..)` and `But(..)` are missing](#function-members-and-and-but-are-missing)

## I get `fs_1.promises.rm is not a function`

Upgrade your node version to at least [v14.14.0](https://nodejs.org/api/fs.html#fspromisesrmpath-options).

## I get `state.messages.findLastIndex is not a function`

Upgrade your node version to at least [v18.0.0](https://nodejs.org/en/blog/announcements/v18-release-announce#v8-101). This only applies to users of any kind of reports (messages, json and html).

## `--env` / `tags` isn't picked up

This might be because you're trying to specify `-e / --env` multiple times, but [multiple values should be comma-separated](https://docs.cypress.io/guides/guides/command-line#cypress-run-env-lt-env-gt).

## Negated tags / complex tag expressions aren't working as expected

Windows / CMD.EXE users must be aware that single-quotes bear no special meaning and should not be used to group words in your shell. For these users, only double-quotes should be used for this purpose. What this means is that, for these users, running `cypress run --env tags='not @foo'` <ins>is not going to behave</ins> and double-quotes must be used. Furthermore, similar scripts contained in `package.json` should also use double-quotes (escaped necessarily, as that is JSON).

## JSON reports aren't generated in open / interactive mode

JSON reports aren't generated in open / interactive mode. They rely on some events that aren't available in open-mode, at least not without `experimentalInteractiveRunEvents: true`. However, this experimental flag broke some time ago, ref. [cypress-io/cypress#18955](https://github.com/cypress-io/cypress/issues/18955), [cypress-io/cypress#26634](https://github.com/cypress-io/cypress/issues/26634). There's unfortunately little indication that these issues will be fixed and meanwhile reports will not be available in open / interactive mode.

## I get `cypress_esbuild_preprocessor_1.createBundler is not a function`

This can happen if you have a TypeScript Cypress configuration (IE. `cypress.config.ts` as opposed to `cypress.config.js`) similar to one of our examples and have a `tsconfig.json` _without_ `{ "compilerOptions": { "esModuleInterop": true } }`.

If you're really adamant about _not_ using `esModuleInterop: true`, you can change

```ts
import createBundler from "@bahmutov/cypress-esbuild-preprocessor";
```

.. to

```ts
import * as createBundler from "@bahmutov/cypress-esbuild-preprocessor";
```

However, I recommend just using `esModuleInterop: true` if you don't fully understand the implications of disabling it.

## I get `cypress_esbuild_preprocessor_1.default is not a function`

See answer above.

## I get `Cannot find module '@badeball/cypress-cucumber-preprocessor/esbuild'`

Set `compilerOptions.moduleResolution` to `node16` in your `tsconfig.json`. Users that are unable to upgrade `moduleResolution` to `node16`, can use the `paths` property as a workaround, like shown below.

```
{
  "compilerOptions": {
    "paths": {
      "@badeball/cypress-cucumber-preprocessor/*": ["./node_modules/@badeball/cypress-cucumber-preprocessor/dist/subpath-entrypoints/*"]
    }
  }
}
```

## My JSON report isn't generated

You may have stumbled upon a configuration caveat (see [docs/configuration.md: Caveats / Debugging](configuration.md#caveats--debugging)) or are overriding some of the plugin's own event handlers (see [docs/event-handlers.md: On event handlers](https://github.com/badeball/cypress-cucumber-preprocessor/blob/master/docs/event-handlers.md)).

## I get `Unexpected state in <state-handler>: <state>`

You might be overriding some of the plugin's own event handlers (see [docs/event-handlers.md: On event handlers](https://github.com/badeball/cypress-cucumber-preprocessor/blob/master/docs/event-handlers.md)).

## Why is `cypress-tags` missing?

The `cypress-tags` executable has been removed and made redundant. Specs containing no matching scenarios are [automatically filtered](https://github.com/badeball/cypress-cucumber-preprocessor/blob/master/docs/tags.md#running-a-subset-of-scenarios), provided that `filterSpecs` is set to true.

## Function members `And(..)` and `But(..)` are missing

These have been [deprecated](https://github.com/badeball/cypress-cucumber-preprocessor/issues/821) to reflect cucumber-js' behavior. You can still however use the `And` keyword in `.feature` files. As explained on [SO](https://stackoverflow.com/questions/24747464/how-to-use-and-in-a-gherkin-using-cucumber-js#comment38690100_24748612),

> `And` is only used in scenarios, not as step definition methods. Semantically it means "same keyword as in previous step"; technically it is just another step. In fact, you can use `Given()`, `When()` and `Then()` interchangeably in your step definitions, Cucumber will not enforce a match between the step keyword and the step definition function.
