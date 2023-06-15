Feature: messages report

  Background:
    Given additional preprocessor configuration
      """
      {
        "messages": {
          "enabled": true
        }
      }
      """

  Rule: it should handle basic scenarioes
    Background:
      Given additional Cypress configuration
        """
        {
          "screenshotOnRunFailure": false
        }
        """

    Scenario: passed example
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/passed-example.ndjson"

    Scenario: passed outline
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario Outline: a scenario
            Given a step
            Examples:
              | value |
              | foo   |
              | bar   |
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/passed-outline.ndjson"

    Scenario: multiple features
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/e2e/b.feature" with:
        """
        Feature: another feature
          Scenario: another scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/multiple-features.ndjson"

    Scenario: failing step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a failing step
            And another step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a failing step", function() {
          throw "some error"
        })
        Given("another step", function () {})
        """
      When I run cypress
      Then it fails
      And there should be a messages similar to "fixtures/failing-step.ndjson"

    Scenario: undefined step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given an undefined step
            And another step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a defined step", function () {})
        """
      When I run cypress
      Then it fails
      And there should be a messages similar to "fixtures/undefined-steps.ndjson"

    Scenario: pending step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a pending step
            And another pending step
            And an implemented step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a pending step", function () {
          return "pending";
        });
        Given("another pending step", function () {
          return "pending";
        });
        Given("an implemented step", () => {});
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/pending-steps.ndjson"

    Scenario: retried
      Given additional Cypress configuration
        """
        {
          "retries": 1
        }
        """
      And a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        let attempt = 0;
        Given("a step", () => {
          if (attempt++ === 0) {
            throw "some error";
          }
        });
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/retried.ndjson"
      # And there should be a messages similar to "fixtures/passed-example.ndjson"

    Scenario: rescued error
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a failing step
            And an unimplemented step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a failing step", function() {
          throw new Error("foobar")
        })
        """
      And a file named "cypress/support/e2e.js" with:
        """
        Cypress.on("fail", (err) => {
          if (err.message.includes("foobar")) {
            return;
          }

          throw err;
        })
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/rescued-error.ndjson"

    Scenario: failing Before hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Before, Given } = require("@badeball/cypress-cucumber-preprocessor");
        Before(function() {
          throw "some error"
        })
        Given("a step", function() {})
        """
      When I run cypress
      Then it fails
      And there should be a messages similar to "fixtures/failing-before.ndjson"

    Scenario: failing After hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { After, Given } = require("@badeball/cypress-cucumber-preprocessor");
        After(function() {
          throw "some error"
        })
        Given("a step", function() {})
        """
      When I run cypress
      Then it fails
      And there should be a messages similar to "fixtures/failing-after.ndjson"

  Rule: step hooks affects the result of the current step
    Background:
      Given additional Cypress configuration
        """
        {
          "screenshotOnRunFailure": false
        }
        """

    Scenario: failing BeforeStep
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a failing step
            And another step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { BeforeStep, Given } = require("@badeball/cypress-cucumber-preprocessor");
        BeforeStep(function() {
          throw "some error"
        })
        Given("a failing step", function() {})
        Given("another step", function () {})
        """
      When I run cypress
      Then it fails
      And there should be a messages similar to "fixtures/failing-step.ndjson"

    Scenario: failing AfterStep
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a failing step
            And another step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { AfterStep, Given } = require("@badeball/cypress-cucumber-preprocessor");
        AfterStep(function() {
          throw "some error"
        })
        Given("a failing step", function() {})
        Given("another step", function () {})
        """
      When I run cypress
      Then it fails
      And there should be a messages similar to "fixtures/failing-step.ndjson"

  Rule: it should contain screenshots captured during a test
    Scenario: explicit screenshot
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function () {
          cy.visit("index.html");
          cy.get("div").screenshot();
        });
        """
      And a file named "index.html" with:
        """
        <!DOCTYPE HTML>
        <style>
          div {
            background: red;
            width: 20px;
            height: 20px;
          }
        </style>
        <div />
        """
      When I run cypress
      Then it passes
      And there should be a messages similar to "fixtures/attachments/screenshot.ndjson"

    Scenario: screenshot of failed test
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a failing step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a failing step", function() {
          throw "some error"
        })
        """
      When I run cypress
      Then it fails
      And the messages report should contain an image attachment for what appears to be a screenshot

  Rule: failing Cypress hooks outside of the plugins control should discontinue the report
    Scenario: failing before hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      And a file named "cypress/support/e2e.js" with:
        """
        before(() => {
          throw "some error"
        });
        """
      When I run cypress
      Then it fails
      And the output should contain
        """
        Hook failures can't be represented in any reports (messages / json / html), thus none is created for cypress/e2e/a.feature.
        """
      And the messages report shouldn't contain any specs

    Scenario: failing beforeEach hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      And a file named "cypress/support/e2e.js" with:
        """
        beforeEach(() => {
          throw "some error"
        });
        """
      When I run cypress
      Then it fails
      And the output should contain
        """
        Hook failures can't be represented in any reports (messages / json / html), thus none is created for cypress/e2e/a.feature.
        """
      And the messages report shouldn't contain any specs

    Scenario: failing afterEach hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      And a file named "cypress/support/e2e.js" with:
        """
        afterEach(() => {
          throw "some error"
        });
        """
      When I run cypress
      Then it fails
      And the output should contain
        """
        Hook failures can't be represented in any reports (messages / json / html), thus none is created for cypress/e2e/a.feature.
        """
      And the messages report shouldn't contain any specs

    Scenario: failing after hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature
          Scenario: a scenario
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {})
        """
      And a file named "cypress/support/e2e.js" with:
        """
        after(() => {
          throw "some error"
        });
        """
      When I run cypress
      Then it fails
      And the output should contain
        """
        Hook failures can't be represented in any reports (messages / json / html), thus none is created for cypress/e2e/a.feature.
        """
      And the messages report shouldn't contain any specs
