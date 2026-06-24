const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map(part => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    if (part.length > 1 && part.startsWith("0")) return Number.NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });

  return octets.every(Number.isInteger)
    ? octets as [number, number, number, number]
    : null;
}

function isRestrictedIpv4([a, b, c]: [number, number, number, number]) {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

export function normalizePublicNetworkHost(input: string): string | null {
  let host = input.trim().toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);

  if (!host || host.length > 253) return null;
  if (host.includes("://") || host.includes(":")) return null;
  if (/[\s/#?@\\[\]]/.test(host)) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;

  const ipv4 = parseIpv4(host);
  if (ipv4) return isRestrictedIpv4(ipv4) ? null : host;

  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (labels.some(label => !HOST_LABEL_RE.test(label))) return null;
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null;

  return host;
}

export function isPublicNetworkHost(input: string) {
  return normalizePublicNetworkHost(input) !== null;
}
