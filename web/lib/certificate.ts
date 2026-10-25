export type Step = {
  hash: string;
  left: boolean;
};

export type Anchor = {
  chain: string;
  tx_hash: string;
  block_number: number;
  block_time: string;
};

export type Certificate = {
  version: 1;
  file_hash: string;
  leaf_index: number;
  steps: Step[];
  root: string;
  anchor: Anchor;
};

export type DemoExport = {
  kind: "etch-demo-export";
  simulated: true;
  warning: string;
  anchor_status: "not-performed";
  certificate: Certificate;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function isRfc3339(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (match[8] !== undefined) {
    const offsetHour = Number(match[8]);
    const offsetMinute = Number(match[9]);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return !Number.isNaN(Date.parse(value));
}

export function parseCertificate(input: unknown): Certificate {
  if (!isRecord(input)) {
    throw new Error("Invalid certificate");
  }

  const { version, file_hash, leaf_index, steps, root, anchor } = input;

  if (version !== 1) {
    throw new Error("Invalid certificate");
  }
  if (!isHex64(file_hash)) {
    throw new Error("Invalid certificate");
  }
  if (!isNonNegativeSafeInteger(leaf_index)) {
    throw new Error("Invalid certificate");
  }
  if (!Array.isArray(steps)) {
    throw new Error("Invalid certificate");
  }

  const parsedSteps: Step[] = [];
  for (const step of steps) {
    if (!isRecord(step)) {
      throw new Error("Invalid certificate");
    }
    const { hash, left } = step;
    if (!isHex64(hash) || typeof left !== "boolean") {
      throw new Error("Invalid certificate");
    }
    parsedSteps.push({ hash: hash.toLowerCase(), left });
  }

  if (!isHex64(root)) {
    throw new Error("Invalid certificate");
  }
  if (!isRecord(anchor)) {
    throw new Error("Invalid certificate");
  }

  const { chain, tx_hash, block_number, block_time } = anchor;
  if (typeof chain !== "string" || typeof tx_hash !== "string") {
    throw new Error("Invalid certificate");
  }
  if (!isNonNegativeSafeInteger(block_number)) {
    throw new Error("Invalid certificate");
  }
  if (!isRfc3339(block_time)) {
    throw new Error("Invalid certificate");
  }

  return {
    version: 1,
    file_hash: file_hash.toLowerCase(),
    leaf_index,
    steps: parsedSteps,
    root: root.toLowerCase(),
    anchor: {
      chain,
      tx_hash,
      block_number,
      block_time,
    },
  };
}

export function parseDemoExport(input: unknown): DemoExport {
  if (!isRecord(input)) {
    throw new Error("Invalid demo export");
  }

  const { kind, simulated, warning, anchor_status, certificate } = input;

  if (kind !== "etch-demo-export") {
    throw new Error("Invalid demo export");
  }
  if (simulated !== true) {
    throw new Error("Invalid demo export");
  }
  if (typeof warning !== "string" || warning.trim().length === 0) {
    throw new Error("Invalid demo export");
  }
  if (anchor_status !== "not-performed") {
    throw new Error("Invalid demo export");
  }

  return {
    kind: "etch-demo-export",
    simulated: true,
    warning,
    anchor_status: "not-performed",
    certificate: parseCertificate(certificate),
  };
}
