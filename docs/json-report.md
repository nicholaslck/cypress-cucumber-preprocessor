[← Back to documentation](readme.md)

# JSON reports

JSON reports can be enabled using the `json.enabled` property. The preprocessor uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig), which means you can place configuration options in EG. `.cypress-cucumber-preprocessorrc.json` or `package.json`. An example configuration is shown below.

```json
{
  "json": {
    "enabled": true
  }
}
```

The report is outputted to `cucumber-report.json` in the project directory, but can be configured through the `json.output` property.

## Screenshots

Screenshots are automatically added to JSON reports, including that of failed tests (unless you have disabled `screenshotOnRunFailure`).

## Attachments

Text, images and other data can be added to the output of the messages and JSON reports with attachments.

```ts
import { Given, attach } from "@badeball/cypress-cucumber-preprocessor";

Given("a step", function() {
  attach("foobar");
});
```

By default, text is saved with a MIME type of text/plain. You can also specify a different MIME type.

```ts
import { Given, attach } from "@badeball/cypress-cucumber-preprocessor";

Given("a step", function() {
  attach('{ "name": "foobar" }', "application/json");
});
```

Images and other binary data can be attached using a ArrayBuffer. The data will be base64 encoded in the output.

```ts
import { Given, attach } from "@badeball/cypress-cucumber-preprocessor";

Given("a step", function() {
  attach(new TextEncoder().encode("foobar").buffer, "text/plain");
});
```

If you've already got a base64-encoded string, you can prefix your mime type with `base64:` to indicate this.

```ts
import { Given, attach } from "@badeball/cypress-cucumber-preprocessor";

Given("a step", function() {
  attach("Zm9vYmFy", "base64:text/plain");
});
```
