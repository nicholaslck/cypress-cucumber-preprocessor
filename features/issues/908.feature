# https://github.com/badeball/cypress-cucumber-preprocessor/issues/908

Feature: hide internals from cypress environment
  Scenario:
    And a file named "cypress/e2e/a.feature" with:
      """
      Feature: a feature
        Scenario: hide internal state by default
          Then the visible internal state should be a mere reference
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const { Then } = require("@badeball/cypress-cucumber-preprocessor");
      Then("the visible internal state should be a mere reference", () => {
        const properties = Cypress.env("__cypress_cucumber_preprocessor_dont_use_this_spec");
        expect(properties).to.be.a("number");
      });
      """
    When I run cypress
    Then it passes
