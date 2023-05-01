import { Then } from "@cucumber/cucumber";
import { JSDOM } from "jsdom";
import path from "path";
import { promises as fs } from "fs";
import assert from "assert";

function assertAndReturn<T>(value: T | null | undefined, msg?: string): T {
  assert(value, msg);
  return value;
}

Then("there should be a HTML report", async function () {
  await assert.doesNotReject(
    () => fs.access(path.join(this.tmpDir, "cucumber-report.html")),
    "Expected there to be a HTML file"
  );
});

Then("the report should display when last run", async function () {
  const dom = await JSDOM.fromFile(
    path.join(this.tmpDir, "cucumber-report.html"),
    { runScripts: "dangerously" }
  );

  const dt = Array.from(dom.window.document.querySelectorAll("dt")).find(
    (el) => el.textContent === "last run"
  );

  assert(dt, "Expected to find a 'last run' dt");

  const dd = dt.parentElement?.querySelector("dd");

  assert(dd, "Expected to find a 'last run' dt's dd");

  const lastRunText = dd.textContent;

  assert(lastRunText, "Expected to find 'XX seconds ago'");

  assert.match(lastRunText, /\d+ seconds? ago/);
});

Then("the report should have an image attachment", async function () {
  const dom = await JSDOM.fromFile(
    path.join(this.tmpDir, "cucumber-report.html"),
    { runScripts: "dangerously" }
  );

  const AccordionItemButton = assertAndReturn(
    dom.window.document.querySelector(
      '[data-accordion-component="AccordionItemButton"]'
    ),
    "Expected to find an AccordionItemButton"
  );

  assert(AccordionItemButton instanceof dom.window.HTMLElement);

  AccordionItemButton.click();

  const AccordionItemPanel = assertAndReturn(
    dom.window.document.querySelector(
      '[data-accordion-component="AccordionItemPanel"]'
    ),
    "Expected to find an AccordionItemPanel"
  );

  assert.match(
    assertAndReturn(
      AccordionItemPanel.textContent,
      "Expected AccordionItemPanel to have textContent"
    ),
    /Attached Image/
  );
});
