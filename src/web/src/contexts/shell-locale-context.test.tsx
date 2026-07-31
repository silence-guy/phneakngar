// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Locale } from "@phneakngar/shared";
import { listWorkspaces } from "@/lib/api";
import { ShellLocaleProvider, useShellLocale } from "./shell-locale-context";

vi.mock("@/lib/api", () => ({
  listWorkspaces: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ workspaceId: "ws-test", slug: "test", memberRole: "owner" }),
}));

// React's act() warns unless the environment is explicitly opt-in (normally done
// by @testing-library; we render with createRoot directly here).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = "phneakngar-shell-locale";

interface ProbeValue {
  locale: string;
  isLoading: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

function Probe({ onRender }: { onRender: (value: ProbeValue) => void }) {
  const { locale, isLoading, setLocale, toggleLocale } = useShellLocale();
  onRender({ locale, isLoading, setLocale, toggleLocale });
  return null;
}

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  vi.mocked(listWorkspaces).mockResolvedValue([]);
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
  vi.clearAllMocks();
});

function renderProbe(): ProbeValue[] {
  const values: ProbeValue[] = [];
  act(() => {
    root = createRoot(container);
    root.render(
      <ShellLocaleProvider>
        <Probe onRender={(value) => values.push(value)} />
      </ShellLocaleProvider>
    );
  });
  return values;
}

/** Flush the workspace default_locale fetch effect. */
async function flushWorkspaceLocale() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useShellLocale", () => {
  it("defaults to khmer locale when nothing is stored or configured", () => {
    const values = renderProbe();
    expect(values.at(-1)!.locale).toBe("km");
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

  it("applies the workspace default_locale when nothing is stored", async () => {
    vi.mocked(listWorkspaces).mockResolvedValue([
      { id: "ws-test", default_locale: "en" } as never,
    ]);
    const values = renderProbe();
    await flushWorkspaceLocale();
    expect(values.at(-1)!.locale).toBe("en");
  });

  it("prefers the user's stored locale over the workspace default_locale", async () => {
    localStorage.setItem(STORAGE_KEY, "km");
    vi.mocked(listWorkspaces).mockResolvedValue([
      { id: "ws-test", default_locale: "en" } as never,
    ]);
    const values = renderProbe();
    await flushWorkspaceLocale();
    expect(values.at(-1)!.locale).toBe("km");
  });

  it("falls back to defaults outside the provider", () => {
    const values: ProbeValue[] = [];
    act(() => {
      root = createRoot(container);
      root.render(<Probe onRender={(value) => values.push(value)} />);
    });
    expect(values.at(-1)!.locale).toBe("km");
    expect(() => values.at(-1)!.toggleLocale()).not.toThrow();
  });
});
