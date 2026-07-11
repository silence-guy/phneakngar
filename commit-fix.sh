#!/bin/bash
git add -A
git commit -m "fix(tests): make tests compatible with bun test

Replaced Vitest-specific APIs with Bun-compatible patterns:
- vi.importActual -> importActual helper from bun-compat
- vi.stubGlobal -> globalThis direct assignment
- vi.unstubAllGlobals -> removed
- vi.hoisted -> direct mock declarations
- vi.mocked -> type assertions
- vi.useFakeTimers -> real setTimeout

Fixed across 100+ test files in web API, lib, and CLI.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
