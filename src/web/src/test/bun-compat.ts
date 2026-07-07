/**
 * Bun test compatibility helpers for Vitest APIs that bun doesn't support.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = ReturnType<typeof import("vitest").vi.fn>;

// Since bun test doesn't support vi.importActual, we need to mock modules directly
// This helper provides a pattern for mocking @phneakngar/shared without importActual
export function createSharedMock(overrides: Record<string, unknown>) {
  return {
    // Provide minimal defaults for commonly mocked items
    DEV_PASSWORD: "dev-pw",
    toPhneakngarAddress: (email: string) => `${email.split("@")[0]}@phneak.ngar`,
    isPhneakngarEmail: (email: string) => email.endsWith("@phneak.ngar"),
    RATE_LIMIT_MAX: 100,
    // ... spread overrides to allow test-specific overrides
    ...overrides,
  };
}

// Helper for mocking fetch in bun test
export function mockFetch(mock: MockFn) {
  globalThis.fetch = mock;
}

// Helper for restoring fetch
export function restoreFetch() {
  // In bun test, we can't easily restore to original fetch
  // Tests should use a fresh mock for each test
}

// Mock for modules that use vi.mock with importActual pattern
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createModuleMock(partialMock: Record<string, any>) {
  return partialMock;
}
