Feature: pretty output

  Background:
    Given additional Cypress configuration
      """
      {
        "reporter": "@badeball/cypress-cucumber-preprocessor/dist/subpath-entrypoints/pretty-reporter.js"
      }
      """

  Rule: it should handle basic scenarioes

    Scenario: passing scenario
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
      """

    Scenario: scenario with rule
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Rule: a rule
            Scenario: a scenario name
              Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Rule: a rule

            Scenario: a scenario name # cypress/e2e/a.feature:3
              Given a step
      """

    Scenario: described feature
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name

          foobar

          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          foobar

          Scenario: a scenario name # cypress/e2e/a.feature:5
            Given a step
      """

    Scenario: tagged feature
      Given a file named "cypress/e2e/a.feature" with:
        """
        @foobar
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        @foobar
        Feature: a feature name # cypress/e2e/a.feature:2

          @foobar
          Scenario: a scenario name # cypress/e2e/a.feature:3
            Given a step
      """

    Scenario: tagged scenario
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          @foobar
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          @foobar
          Scenario: a scenario name # cypress/e2e/a.feature:3
            Given a step
      """

    Scenario: docstring
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
              \"\"\"
              foobar
              \"\"\"

        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
              \"\"\"
              foobar
              \"\"\"
      """

    Scenario: datatable
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
              | foo |
              | bar |

        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
              │ foo │
              │ bar │
      """

    Scenario: failing step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() { throw "some error" });
        """
      When I run cypress
      Then it fails
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
            ✖ failed
              some error
      """

    Scenario: failing before hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Before, Given } = require("@badeball/cypress-cucumber-preprocessor");
        Before(function() { throw "some error" });
        Given("a step", function() {});
        """
      When I run cypress
      Then it fails
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            ✖ failed
              some error
            Given a step
            - skipped
      """

    Scenario: failing after hook
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { After, Given } = require("@badeball/cypress-cucumber-preprocessor");
        After(function() { throw "some error" });
        Given("a step", function() {});
        """
      When I run cypress
      Then it fails
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
            ✖ failed
              some error
      """

    Scenario: ambiguous step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {});
        Given("a step", function() {});
        """
      When I run cypress
      Then it fails
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
            ✖ ambiguous
              Multiple matching step definitions for: a step
               a step
               a step
      """

    Scenario: pending step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        const { Given } = require("@badeball/cypress-cucumber-preprocessor");
        Given("a step", function() {
          return "pending";
        });
        """
      When I run cypress
      Then it passes
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
            ? pending
      """

    Scenario: undefined step
      Given a file named "cypress/e2e/a.feature" with:
        """
        Feature: a feature name
          Scenario: a scenario name
            Given a step
        """
      And a file named "cypress/support/step_definitions/steps.js" with:
        """
        // empty
        """
      When I run cypress
      Then it fails
      And the output should contain
      """
        Feature: a feature name # cypress/e2e/a.feature:1

          Scenario: a scenario name # cypress/e2e/a.feature:2
            Given a step
            ? undefined
      """

    Scenario: retried scenario
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
      And the output should contain
      """
        Feature: a feature # cypress/e2e/a.feature:1

          Scenario: a scenario # cypress/e2e/a.feature:2
            Given a step
            ✖ failed
              some error

          Scenario: a scenario # cypress/e2e/a.feature:2
            Given a step
      """
