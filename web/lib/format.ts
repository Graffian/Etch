const UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1
  );

  if (unitIndex === 0) {
    return `${Math.round(bytes)} B`;
  }

  const value = bytes / 1024 ** unitIndex;
  return `${Number(value.toFixed(1))} ${UNITS[unitIndex]}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function isZeroTime(iso: string): boolean {
  return iso === "0001-01-01T00:00:00Z";
}
