Feature: hooks ordering

  Hooks should be executed in the following order:
   - before
   - beforeEach
   - Before
   - Background steps
   - BeforeStep
   - Ordinary steps
   - AfterStep (in reverse order)
   - After
   - afterEach
   - after

  Scenario: with all hooks incrementing a counter
    Given a file named "cypress/e2e/a.feature" with:
      """
      Feature: a feature
        Background:
          Given a background step
        Scenario: a scenario
          Given an ordinary step
      """
    And a file named "cypress/support/step_definitions/steps.js" with:
      """
      const {
        Given,
        Before,
        After,
        BeforeStep,
        AfterStep
      } = require("@badeball/cypress-cucumber-preprocessor")
      let counter;
      before(function() {
        counter = 0;
      })
      beforeEach(function() {
        expect(counter++, "Expected beforeEach() to be called after before()").to.equal(0)
      })
      Before(function() {
        expect(counter++, "Expected Before() to be called after beforeEach()").to.equal(1)
      })
      Given("a background step", function() {
        expect(counter++, "Expected a background step to be called after Before()").to.equal(2)
      })
      BeforeStep(function ({ pickleStep }) {
        if (pickleStep.text === "an ordinary step") {
          expect(counter++, "Expected BeforeStep() to be called before ordinary steps").to.equal(3)
        }
      })
      Given("an ordinary step", function() {
        expect(counter++, "Expected an ordinary step to be called after a background step").to.equal(4)
      })
      AfterStep(function ({ pickleStep }) {
        if (pickleStep.text === "an ordinary step") {
          expect(counter++, "Expected AfterStep() to be called after ordinary steps").to.equal(6)
        }
      })
      AfterStep(function ({ pickleStep }) {
        if (pickleStep.text === "an ordinary step") {
          expect(counter++, "Expected AfterStep() to be called after ordinary steps").to.equal(5)
        }
      })
      After(function() {
        expect(counter++, "Expected After() to be called after ordinary steps").to.equal(7)
      })
      afterEach(function() {
        expect(counter++, "Expected afterEach() to be called after After()").to.equal(8)
      })
      after(function() {
        expect(counter++, "Expected after() to be called after afterEach()").to.equal(9)
      })
      """
    When I run cypress
    Then it passes
