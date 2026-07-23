// Agent category colors — Geist accent families (amber, green, blue, red, purple, teal).
// Chips use ~700-step solids with WCAG-AA ink: #171717 on the lighter amber/green/teal,
// white on blue/red/purple. Standalone light-mode ink labels use step-900 hues on white.

export function agentColor(agentId: string): string {
  const palette = [
    "bg-[#ffae00] text-[#171717]",
    "bg-[#00ac3a] text-[#171717]",
    "bg-[#006bff] text-[#fff]",
    "bg-[#ea001d] text-[#fff]",
    "bg-[#9440d5] text-[#fff]",
    "bg-[#00cfb7] text-[#171717]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

export function agentDot(agentId: string): string {
  const palette = [
    "bg-[#ffae00] dark:bg-[#ffd54f]",
    "bg-[#00ac3a] dark:bg-[#00d86a]",
    "bg-[#006bff] dark:bg-[#3898ff]",
    "bg-[#ea001d] dark:bg-[#ff5e5e]",
    "bg-[#9440d5] dark:bg-[#b073f0]",
    "bg-[#00a38f] dark:bg-[#17c2a8]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

export function agentInk(agentId: string): string {
  const palette = [
    "text-[#8a5300] dark:text-[#fff]",
    "text-[#116329] dark:text-[#fff]",
    "text-[#006bff] dark:text-[#fff]",
    "text-[#ea001d] dark:text-[#fff]",
    "text-[#9440d5] dark:text-[#fff]",
    "text-[#00594a] dark:text-[#fff]",
  ];
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}
