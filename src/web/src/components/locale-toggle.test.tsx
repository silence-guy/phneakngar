// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LandingLocaleProvider } from "@/components/home/use-landing-locale";
import { LocaleToggle } from "./locale-toggle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = "landing-locale";

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  const currentRoot = root;
  if (currentRoot) {
    act(() => {
      currentRoot.unmount();
    });
    root = null;
  }
  document.body.removeChild(container);
});

function renderToggle(): HTMLElement {
  let mounted: HTMLElement | null = null;
  act(() => {
    root = createRoot(container);
    root.render(
      <LandingLocaleProvider>
        <LocaleToggle />
      </LandingLocaleProvider>
    );
  });
  mounted = container;
  return mounted;
}

describe("LocaleToggle", () => {
  it("renders EN and KH buttons", () => {
    const el = renderToggle();
    const buttons = el.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0]!.textContent).toBe("EN");
    expect(buttons[1]!.textContent).toBe("KH");
  });

  it("starts with KH active by default and persists toggling", () => {
    const el = renderToggle();
    const buttons = el.querySelectorAll("button");
    const enButton = buttons[0]!;
    const khButton = buttons[1]!;

    expect(khButton.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      enButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(enButton.getAttribute("aria-pressed")).toBe("true");
    expect(khButton.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
