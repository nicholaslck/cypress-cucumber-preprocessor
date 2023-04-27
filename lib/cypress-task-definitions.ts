import messages from "@cucumber/messages";

export const TASK_APPEND_MESSAGES =
  "cypress-cucumber-preprocessor:append-messages";

export interface ITaskAppendMessages {
  messages: messages.Envelope[];
}

export const TASK_TEST_CASE_STARTED =
  "cypress-cucumber-preprocessor:test-case-started";

export interface ITaskTestCaseStarted {
  testCaseStartedId: string;
}

export const TASK_TEST_STEP_STARTED =
  "cypress-cucumber-preprocessor:test-step-started";

export interface ITaskTestStepStarted {
  testStepId: string;
}

export const TASK_CREATE_STRING_ATTACHMENT =
  "cypress-cucumber-preprocessor:create-string-attachment";

export interface ITaskCreateStringAttachment {
  data: string;
  mediaType: string;
  encoding: messages.AttachmentContentEncoding;
}
