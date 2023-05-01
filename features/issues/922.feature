# https://github.com/badeball/cypress-cucumber-preprocessor/issues/946

Feature: visualizing hook with filter
  Scenario: visualizing hook with filter
    Given a file named "cypress/e2e/a.feature" with:
      """
      @foo
      Feature: a feature
        Scenario: a scenario
          Given a step
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const { Before, Given } = require("@badeball/cypress-cucumber-preprocessor");
      Before(() => {})
      Before({ tags: "@foo or @bar" }, () => {})
      Given("a step", function() {
        // TODO: figure out how to query Cypress' own UI, if at all possible.
      })
      """
    When I run cypress
    Then it passes
