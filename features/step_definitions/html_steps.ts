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

  const dt = assertAndReturn(
    Array.from(dom.window.document.querySelectorAll("dt")).find(
      (el) => el.textContent === "last run"
    ),
    "Expected to find a 'last run' dt"
  );

  const dd = assertAndReturn(
    dt.parentElement?.querySelector("dd"),
    "Expected to find a 'last run' dt's dd"
  );

  const lastRunText = assertAndReturn(
    dd.textContent,
    "Expected to find 'XX seconds ago'"
  );

  assert.match(lastRunText, /\d+ seconds? ago/);
});

Then(
  "the HTML should display {int} executed scenario(s)",
  async function (n: number) {
    const dom = await JSDOM.fromFile(
      path.join(this.tmpDir, "cucumber-report.html"),
      { runScripts: "dangerously" }
    );

    const dt = assertAndReturn(
      Array.from(dom.window.document.querySelectorAll("dt")).find(
        (el) => el.textContent && /\d+ executed/.test(el.textContent)
      ),
      "Expected to find a 'XX executed' dt"
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const actual = parseInt(dt.textContent!, 10);

    assert.equal(actual, n);
  }
);

Then(
  "the HTML should display {int}% passed scenarios",
  async function (n: number) {
    const dom = await JSDOM.fromFile(
      path.join(this.tmpDir, "cucumber-report.html"),
      { runScripts: "dangerously" }
    );

    const dd = assertAndReturn(
      Array.from(dom.window.document.querySelectorAll("dd")).find(
        (el) => el.textContent && /\d+% passed/.test(el.textContent)
      ),
      "Expected to find a 'XX% passed' dd"
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const actual = parseInt(dd.textContent!, 10);

    console.log({ actual });

    assert.equal(actual, n);
  }
);

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
