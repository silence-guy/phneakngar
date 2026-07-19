/** Pure view-state for activity list (loading / error / empty / list). */

export type ActivityListView = "loading" | "error" | "empty" | "list";

export function resolveActivityListView(input: {
  loading: boolean;
  loadError: boolean;
  itemCount: number;
}): ActivityListView {
  if (input.loading) return "loading";
  if (input.loadError) return "error";
  if (input.itemCount <= 0) return "empty";
  return "list";
}
