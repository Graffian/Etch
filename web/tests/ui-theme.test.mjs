import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function cssToken(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return match?.[1] ?? null;
}

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

test("muted text meets WCAG AA contrast on the paper surface", () => {
  const paper = cssToken("paper");
  const muted = cssToken("ink-muted");
  assert.ok(paper && muted, "paper and muted text tokens must be defined");

  const ratio = contrastRatio(muted, paper);
  assert.ok(
    ratio >= 4.5,
    `--ink-muted ${muted} has only ${ratio.toFixed(2)}:1 contrast on --paper ${paper}`
  );
});

test("interactive control border has at least 3:1 contrast on raised surface", () => {
  const raised = cssToken("paper-raised");
  const border = cssToken("control-border");
  assert.ok(raised, "--paper-raised must be defined");
  assert.ok(border, "--control-border must be defined");

  const ratio = contrastRatio(border, raised);
  assert.ok(
    ratio >= 3,
    `--control-border ${border} has only ${ratio.toFixed(2)}:1 contrast on --paper-raised ${raised}`
  );
});

test("status messages use a full border and no accent rail", () => {
  const rule = css.match(/\.status-message\s*\{([^}]*)\}/)?.[1];
  assert.ok(rule, "the .status-message rule must exist");
  assert.match(rule, /border:\s*1px solid var\(--control-border\)/);
  assert.doesNotMatch(rule, /border-left/);
});
