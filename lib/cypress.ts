import DataTable from "./data_table";

const ensureChain = (value: unknown): Cypress.Chainable<unknown> =>
  Cypress.isCy(value) ? value : cy.wrap(value, { log: false });

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

  return ensureChain(options.fn()).then((result) => {
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

  Cypress.log({
    name: "",
    message: table.raw().join("\n"),
    groupStart: false,
  } as object);

  return ensureChain(options.fn()).then((result) => {
    Cypress.log({ groupEnd: true, emitOnly: true } as object);
    return result;
  });
}
