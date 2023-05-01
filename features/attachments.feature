Feature: attachments

  Background:
    Given additional preprocessor configuration
      """
      {
        "json": {
          "enabled": true
        }
      }
      """

  # This test's result will likely change in the future, see
  # https://github.com/cucumber/cucumber-js/issues/2260 and
  # https://github.com/cucumber/cucumber-js/pull/2261
  Scenario: string identity
    Given a file named "cypress/e2e/a.feature" with:
      """
      Feature: a feature
        Scenario: a scenario
          Given a step
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const { Given, attach } = require("@badeball/cypress-cucumber-preprocessor");
      Given("a step", function() {
        attach("foobar")
      })
      """
    When I run cypress
    Then it passes
    And there should be a JSON output similar to "fixtures/attachments/string-literal.json"

  Scenario: array buffer
    Given a file named "cypress/e2e/a.feature" with:
      """
      Feature: a feature
        Scenario: a scenario
          Given a step
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const { Given, attach } = require("@badeball/cypress-cucumber-preprocessor");
      Given("a step", function() {
        attach(new TextEncoder().encode("foobar").buffer, "text/plain")
      })
      """
    When I run cypress
    Then it passes
    And there should be a JSON output similar to "fixtures/attachments/string-base64.json"

  Scenario: string encoded
    Given a file named "cypress/e2e/a.feature" with:
      """
      Feature: a feature
        Scenario: a scenario
          Given a step
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const { fromByteArray } = require("base64-js");
      const { Given, attach } = require("@badeball/cypress-cucumber-preprocessor");
      Given("a step", function() {
        attach(fromByteArray(new TextEncoder().encode("foobar")), "base64:text/plain")
      })
      """
    When I run cypress
    Then it passes
    And there should be a JSON output similar to "fixtures/attachments/string-base64.json"
