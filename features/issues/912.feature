# https://github.com/badeball/cypress-cucumber-preprocessor/issues/912

Feature: global Before hook
  Scenario:
    Given a file named "cypress/e2e/a.feature" with:
      """
      @foo
      Feature: a feature
        Scenario: a scenario
          Given a step
      """
    And a file named "cypress/e2e/b.feature" with:
      """
      @foo
      Feature: a feature
        Scenario: a scenario
          Given a step
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const { Before, Given } = require("@badeball/cypress-cucumber-preprocessor");
      Before({ tags: "@foo" }, function () {
        this.foo = "bar";
      });
      Given("a step", function() {
        expect(this.foo).to.equal("bar");
      })
      """
    When I run cypress
    Then it passes
    And it should appear to have ran spec "a.feature" and "b.feature"
