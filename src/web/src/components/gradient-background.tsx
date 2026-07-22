export function GradientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* Flat Geist canvas with a faint neutral dot grid — no ambient warm glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.045)_1px,transparent_1px)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px]" />
    </div>
  );
}
