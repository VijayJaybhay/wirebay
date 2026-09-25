#!/usr/bin/env node
/**
 * wirebay CLI entry point.
 * @module
 */

import { WirebayApp } from "./app/WirebayApp.ts";

process.exitCode = await new WirebayApp().run(process.argv.slice(2));
