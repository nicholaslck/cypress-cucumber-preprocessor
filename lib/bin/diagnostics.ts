#!/usr/bin/env node

import { execute } from "../diagnostics";

execute({ argv: process.argv, env: process.env, cwd: process.cwd() }).catch(
  console.error
);
