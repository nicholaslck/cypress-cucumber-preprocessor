[← Back to documentation](readme.md)

# Diagnostics / dry run

A diagnostics utility is provided to verify that each step matches one, and only one, step definition. This can be run as shown below.

```
$ npx cypress-cucumber-diagnostics
```

This supports some of the same flags as Cypress, including

- `-P / --project` for specifying project directories aside from current working directory
- `-e / --env` for EG. specifying a different value for `stepDefinitions`

The intention here being that whatever flags you use to run `cypress run` can also be consumed by the executable to give appropriate diagnostics.

> :warning:	This feature is especially experimental, it's subject to change anytime and is not considered under semver.
