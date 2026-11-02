import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The app is a public portfolio project: no personal names or dedications in the UI.
const files = ["app/layout.tsx", "app/page.tsx"];

test("the UI names no one and carries a neutral title", () => {
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /Clara|Heng Jia Ee|Money Diary|especially for/i, file);
  }
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /title: "Finance Tracker"/);
});
