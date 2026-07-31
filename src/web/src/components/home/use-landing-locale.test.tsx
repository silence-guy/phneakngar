// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { LandingLocaleProvider, useLandingLocale } from "./use-landing-locale";

// React's act() warns unless the environment is explicitly opt-in (normally done
// by @testing-library; we render with createRoot directly here).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = "landing-locale";

interface ProbeValue {
  locale: string;
  mounted: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

function Probe({ onRender }: { onRender: (value: ProbeValue) => void }) {
  const { locale, mounted, setLocale, toggleLocale } = useLandingLocale();
  onRender({ locale, mounted, setLocale, toggleLocale });
  return null;
}

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

function renderProbe(): ProbeValue[] {
  const values: ProbeValue[] = [];
  act(() => {
    root = createRoot(container);
    root.render(
      <LandingLocaleProvider>
        <Probe onRender={(value) => values.push(value)} />
      </LandingLocaleProvider>
    );
  });
  return values;
}

describe("useLandingLocale", () => {
  it("defaults to khmer locale when nothing is stored", () => {
    const values = renderProbe();

    expect(values.at(-1)!.locale).toBe("km");
    expect(values.at(-1)!.mounted).toBe(true);
  });

  it("toggles between km and en", () => {
    const values = renderProbe();

    act(() => values.at(-1)!.toggleLocale());
    expect(values.at(-1)!.locale).toBe("en");

    act(() => values.at(-1)!.toggleLocale());
    expect(values.at(-1)!.locale).toBe("km");
  });

  it("persists the selected locale to localStorage", () => {
    const values = renderProbe();

    act(() => values.at(-1)!.setLocale(Locale.EN));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");
  });

  it("restores the stored locale on a fresh provider mount", () => {
    const first = renderProbe();
    act(() => first.at(-1)!.toggleLocale());
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");

    act(() => {
      root!.unmount();
      root = null;
    });
    document.body.removeChild(container);
    container = document.createElement("div");
    document.body.appendChild(container);

    const second = renderProbe();
    expect(second.at(-1)!.locale).toBe("en");
  });

  it("syncs document.documentElement.lang to the locale", () => {
    const values = renderProbe();

    expect(document.documentElement.lang).toBe("km");

    act(() => values.at(-1)!.toggleLocale());
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to defaults outside the provider", () => {
    const values: ProbeValue[] = [];
    act(() => {
      root = createRoot(container);
      root.render(<Probe onRender={(value) => values.push(value)} />);
    });

    expect(values.at(-1)!.locale).toBe("km");
    expect(values.at(-1)!.mounted).toBe(false);
    expect(() => values.at(-1)!.toggleLocale()).not.toThrow();
  });
});
