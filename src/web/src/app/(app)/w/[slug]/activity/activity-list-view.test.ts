import { describe, expect, it } from "vitest";
import { resolveActivityListView } from "./activity-list-view";

describe("resolveActivityListView", () => {
  it("prefers loading", () => {
    expect(
      resolveActivityListView({ loading: true, loadError: true, itemCount: 3 }),
    ).toBe("loading");
  });

  it("shows error over empty", () => {
    expect(
      resolveActivityListView({ loading: false, loadError: true, itemCount: 0 }),
    ).toBe("error");
  });

  it("shows empty when no error and no items", () => {
    expect(
      resolveActivityListView({ loading: false, loadError: false, itemCount: 0 }),
    ).toBe("empty");
  });

  it("shows list when items present", () => {
    expect(
      resolveActivityListView({ loading: false, loadError: false, itemCount: 2 }),
    ).toBe("list");
  });
});
