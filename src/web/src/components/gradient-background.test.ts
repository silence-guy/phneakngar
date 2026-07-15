import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GradientBackground } from "./gradient-background";

describe("GradientBackground", () => {
  it("renders warm light and dark background tokens with subtle grain", () => {
    const markup = renderToStaticMarkup(createElement(GradientBackground));

    expect(markup).toContain("bg-[oklch(0.94_0.014_78)]");
    expect(markup).toContain("dark:bg-[oklch(0.15_0.008_60)]");
    expect(markup).toContain("radial-gradient");
    expect(markup).toContain("data:image/svg+xml");
  });
});
