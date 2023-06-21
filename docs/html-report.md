[← Back to documentation](readme.md)

# HTML reports

HTML reports are powered by [`@cucumber/html-formatter`](https://github.com/cucumber/html-formatter). They can be enabled using the `html.enabled` property. The preprocessor uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig), which means you can place configuration options in EG. `.cypress-cucumber-preprocessorrc.json` or `package.json`. An example configuration is shown below.

```json
{
  "html": {
    "enabled": true
  }
}
```

The report is outputted to `cucumber-report.html` in the project directory, but can be configured through the `html.output` property.
