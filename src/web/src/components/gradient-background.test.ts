import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GradientBackground } from "./gradient-background";

describe("GradientBackground", () => {
  it("renders a flat Geist background with a faint neutral dot grid", () => {
    const markup = renderToStaticMarkup(createElement(GradientBackground));

    expect(markup).toContain("bg-background");
    expect(markup).toContain("radial-gradient");
    expect(markup).toContain("background-size:24px_24px");
    expect(markup).not.toContain("oklch");
  });
});
