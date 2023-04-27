import messages from "@cucumber/messages";

import { Registry } from "./lib/registry";

declare module "@cucumber/cucumber" {
  interface IWorld {
    tmpDir: string;
    verifiedLastRunError: boolean;
    lastRun: {
      stdout: string;
      stderr: string;
      output: string;
      exitCode: number;
    };
  }
}

declare global {
  namespace globalThis {
    var __cypress_cucumber_preprocessor_dont_use_this: true | undefined;

    var __cypress_cucumber_preprocessor_registry_dont_use_this:
      | Registry
      | undefined;
  }

  interface Window {
    testState: {
      gherkinDocument: messages.GherkinDocument;
      pickles: messages.Pickle[];
      pickle: messages.Pickle;
      pickleStep?: messages.PickleStep;
    };
  }
}

export {};
