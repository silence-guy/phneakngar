const paperGrain =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GradientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[oklch(0.94_0.014_78)] dark:bg-[oklch(0.15_0.008_60)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.98_0.008_82)_0%,oklch(0.94_0.014_78)_42%,oklch(0.90_0.018_72)_100%)] dark:bg-[radial-gradient(circle_at_50%_0%,oklch(0.23_0.010_62)_0%,oklch(0.16_0.008_60)_48%,oklch(0.12_0.006_58)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.045] dark:opacity-[0.06]"
        style={{ backgroundImage: paperGrain }}
      />
    </div>
  );
}
