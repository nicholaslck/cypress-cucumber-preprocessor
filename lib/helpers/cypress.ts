import DataTable from "../data_table";
import { CypressCucumberError } from "./error";

const ensureChain = (value: unknown): Cypress.Chainable<unknown> =>
  Cypress.isCy(value) ? value : cy.wrap(value, { log: false });

// eslint-disable-next-line @typescript-eslint/no-empty-function
const nativePromiseConstructor = (async () => {})().constructor;

export function runStepWithLogGroup(options: {
  fn: () => unknown;
  keyword: string;
  text?: string;
}) {
  Cypress.log({
    name: options.keyword,
    message: options.text == null ? "" : `**${options.text}**`,
    groupStart: true,
  } as object);

  const ret = options.fn();

  if (ret instanceof nativePromiseConstructor) {
    throw new CypressCucumberError(
      "Cucumber preprocessor detected that you returned a native promise from a function handler, this is not supported. Using async / await is generally speaking not supported when using Cypress, period, preprocessor or not."
    );
  }

  return ensureChain(ret).then((result) => {
    Cypress.log({ groupEnd: true, emitOnly: true } as object);
    return result;
  });
}

export function runStepWithLogGroupAndCompanionTable(
  options: {
    fn: () => unknown;
    keyword: string;
    text?: string;
  },
  table: DataTable
) {
  Cypress.log({
    name: options.keyword,
    message: options.text == null ? "" : `**${options.text}**`,
    groupStart: true,
  } as object);

  const rawTable = table.raw();

  function getMaxColumnWidths(tableArray: any) {
    const maxColumnWidths: any[] = [];

    for (const row of tableArray) {
      for (let i = 0; i < row.length; i++) {
        const cell = row[i];
        const cellWidth = cell.length;
        maxColumnWidths[i] = Math.max(maxColumnWidths[i] || 0, cellWidth);
      }
    }

    return maxColumnWidths;
  }

  function padElements(tableArray: any[], maxColumnWidths: any[]) {
    return tableArray.map((row) =>
      row.map(
        (cell: string, index: any) =>
          (cell = cell + "&nbsp;".repeat(maxColumnWidths[index] - cell.length))
      )
    );
  }

  function convertArrayToTableString(tableArray: any[]) {
    const maxColumnWidths = getMaxColumnWidths(tableArray);
    const paddedTableArray = padElements(tableArray, maxColumnWidths);
    const lines = paddedTableArray.map((row) => row.join("|"));
    const tableString = lines.join("\n");
    return tableString;
  }

  const result = convertArrayToTableString(rawTable);
  //&nbsp;

  Cypress.log({
    name: "",
    message: "|" + result + "&nbsp;|",
    groupStart: false,
  } as object);

  return ensureChain(options.fn()).then((result) => {
    Cypress.log({ groupEnd: true, emitOnly: true } as object);
    return result;
  });
}
