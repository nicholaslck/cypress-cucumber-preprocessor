import { Then } from "@cucumber/cucumber";
import messages from "@cucumber/messages";
import path from "path";
import { promises as fs } from "fs";
import assert from "assert";
import { toByteArray } from "base64-js";
import { PNG } from "pngjs";

function isObject(object: any): object is object {
  return typeof object === "object" && object != null;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function hasOwnProperty<X extends {}, Y extends PropertyKey>(
  obj: X,
  prop: Y
): obj is X & Record<Y, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function* traverseTree(object: any): Generator<object, void, any> {
  if (!isObject(object)) {
    throw new Error(`Expected object, got ${typeof object}`);
  }

  yield object;

  for (const property of Object.values(object)) {
    if (isObject(property)) {
      yield* traverseTree(property);
    }
  }
}

function prepareMessagesReport(messages: any) {
  const idProperties = [
    "id",
    "hookId",
    "testStepId",
    "testCaseId",
    "testCaseStartedId",
    "pickleId",
    "pickleStepId",
  ] as const;

  const idCollectionProperties = ["astNodeIds", "stepDefinitionIds"] as const;

  for (const message of messages) {
    for (const node of traverseTree(message)) {
      if (hasOwnProperty(node, "duration")) {
        node.duration = 0;
      }

      if (hasOwnProperty(node, "timestamp")) {
        node.timestamp = {
          seconds: 0,
          nanos: 0,
        };
      }

      if (hasOwnProperty(node, "uri") && typeof node.uri === "string") {
        node.uri = node.uri.replace(/\\/g, "/");
      }

      for (const idProperty of idProperties) {
        if (hasOwnProperty(node, idProperty)) {
          node[idProperty] = "id";
        }
      }

      for (const idCollectionProperty of idCollectionProperties) {
        if (hasOwnProperty(node, idCollectionProperty)) {
          node[idCollectionProperty] = (node[idCollectionProperty] as any).map(
            () => "id"
          );
        }
      }
    }
  }

  return messages;
}

function stringToNdJson(content: string) {
  return content
    .toString()
    .trim()
    .split("\n")
    .map((line: any) => JSON.parse(line));
}

function ndJsonToString(ndjson: any) {
  return ndjson.map((o: any) => JSON.stringify(o)).join("\n") + "\n";
}

async function readMessagesReport(
  cwd: string,
  options: { normalize: boolean } = { normalize: true }
): Promise<messages.Envelope[]> {
  const absoluteMessagesPath = path.join(cwd, "cucumber-messages.ndjson");

  const content = await fs.readFile(absoluteMessagesPath);

  const messages = stringToNdJson(content.toString());

  if (options.normalize) {
    return prepareMessagesReport(messages);
  } else {
    return messages;
  }
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

Then(
  "the messages should only contain a single {string} and a single {string}",
  async function (a, b) {
    const absoluteMessagesPath = path.join(
      this.tmpDir,
      "cucumber-messages.ndjson"
    );

    const messages = (await fs.readFile(absoluteMessagesPath))
      .toString()
      .trim()
      .split("\n")
      .map((string) => JSON.parse(string));

    const aCount = messages.filter((m) => m[a]).length;
    const bCount = messages.filter((m) => m[b]).length;

    if (aCount !== 1) {
      throw new Error(`Expected to find a single "${a}", but found ${aCount}`);
    }

    if (bCount !== 1) {
      throw new Error(`Expected to find a single "${b}", but found ${bCount}`);
    }
  }
);

Then("there should be a messages report", async function () {
  await assert.doesNotReject(
    () => fs.access(path.join(this.tmpDir, "cucumber-messages.ndjson")),
    "Expected there to be a messages file"
  );
});

Then(
  "there should be a messages similar to {string}",
  async function (fixturePath) {
    const ndjson = await readMessagesReport(this.tmpDir);

    const absoluteExpectedJsonpath = path.join(
      process.cwd(),
      "features",
      fixturePath
    );

    if (process.env.WRITE_FIXTURES) {
      await fs.writeFile(absoluteExpectedJsonpath, ndJsonToString(ndjson));
    } else {
      const expectedJsonOutput = stringToNdJson(
        (await fs.readFile(absoluteExpectedJsonpath)).toString()
      );

      assert.deepStrictEqual(ndjson, expectedJsonOutput);
    }
  }
);

Then(
  "the messages report should contain an image attachment for what appears to be a screenshot",
  async function () {
    const messages = await readMessagesReport(this.tmpDir);

    const attachments: messages.Attachment[] = messages
      .map((m) => m.attachment)
      .filter(notEmpty);

    if (attachments.length === 0) {
      throw new Error("Expected to find an attachment, but found none");
    } else if (attachments.length > 1) {
      throw new Error(
        "Expected to find a single attachment, but found " + attachments.length
      );
    }

    const [attachment] = attachments;

    assert.strictEqual(attachment.mediaType, "image/png");

    const png = await new Promise<PNG>((resolve, reject) => {
      new PNG().parse(
        Buffer.from(toByteArray(attachment.body)),
        function (error, data) {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        }
      );
    });

    const expectedDimensions = {
      width: 1280,
      height: 720,
    };

    const { width: actualWidth, height: actualHeight } = png;

    assert.strictEqual(actualWidth, expectedDimensions.width);
    assert.strictEqual(actualHeight, expectedDimensions.height);
  }
);

Then("the messages report shouldn't contain any specs", async function () {
  const messages = await readMessagesReport(this.tmpDir);

  for (const message of messages) {
    if (message.gherkinDocument) {
      throw new Error(
        `Expected to find no specs, but found a gherkin document`
      );
    }
  }
});

Then(
  "the message report should contain a non-zero duration of the step",
  async function () {
    const messages = await readMessagesReport(this.tmpDir, {
      normalize: false,
    });

    type TestStepFinishedEnvelope = Pick<
      Required<messages.Envelope>,
      "testStepFinished"
    >;

    const isTestStepFinishedEnvelope = (
      envelope: messages.Envelope
    ): envelope is TestStepFinishedEnvelope => !!envelope.testStepFinished;

    const testStepFinishedCol: TestStepFinishedEnvelope[] = messages.filter(
      isTestStepFinishedEnvelope
    );

    if (testStepFinishedCol.length !== 1) {
      throw new Error(
        "Expected to find a single testStepFinished envelope, but found " +
          testStepFinishedCol.length
      );
    }

    const [{ testStepFinished }] = testStepFinishedCol;

    if (
      testStepFinished.testStepResult.duration.seconds === 0 &&
      testStepFinished.testStepResult.duration.nanos === 0
    ) {
      throw new Error("Expected to find non-zero duration");
    }
  }
);
