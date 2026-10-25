import type { Certificate as CertificateRecord } from "@/lib/certificate";

import { formatTimestamp, isZeroTime } from "@/lib/format";
import { StatusMessage } from "./StatusMessage";

type CertificateProps = {
  certificate?: CertificateRecord | null;
  emptyTitle?: string;
  emptyText?: string;
};

export function Certificate({
  certificate,
  emptyTitle = "No certificate loaded",
  emptyText = "No certificate fields are available here yet. A missing record is not evidence that a certificate is invalid.",
}: CertificateProps) {
  if (!certificate) {
    return (
      <section
        className="certificate-card certificate-card--empty"
        aria-label="Certificate record"
      >
        <h2>{emptyTitle}</h2>
        <p className="certificate-card__lead">{emptyText}</p>
        <StatusMessage tone="info" title="Nothing to show">
          No certificate was loaded, so no fields are displayed and no anchor is
          checked.
        </StatusMessage>
      </section>
    );
  }

  const cert = certificate;
  const { anchor } = cert;
  const anchored =
    anchor.block_number !== 0 || !isZeroTime(anchor.block_time);

  function download() {
    const blob = new Blob([JSON.stringify(cert, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etch-${cert.file_hash.slice(0, 16)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="certificate-card" aria-label="Certificate record">
      <div className="certificate-card__head">
        <h2>Timestamped file</h2>
        <p className="certificate-card__badge">
          {anchor.chain || "unconfirmed"}
        </p>
      </div>
      <p className="certificate-card__lead">
        Binds the file&apos;s SHA-256 digest into a Merkle root that the Etch
        server anchored on its chain.
      </p>
      <dl className="certificate-meta">
        <div>
          <dt>File digest</dt>
          <dd>
            <code className="hash hash--block">{certificate.file_hash}</code>
          </dd>
        </div>
        <div>
          <dt>Merkle root</dt>
          <dd>
            <code className="hash hash--block">{certificate.root}</code>
          </dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            <span className="certificate-meta__value">
              Leaf {certificate.leaf_index}
            </span>
            <span className="certificate-meta__aside">
              {certificate.steps.length} proof{" "}
              {certificate.steps.length === 1 ? "step" : "steps"} · version{" "}
              {certificate.version}
            </span>
          </dd>
        </div>
      </dl>
      <div className="certificate-card__anchor">
        <h3>{anchor.chain ? `Chain · ${anchor.chain}` : "Not anchored"}</h3>
        {anchored ? (
          <dl className="certificate-meta">
            <div>
              <dt>Transaction</dt>
              <dd>
                <code className="hash hash--block">{anchor.tx_hash}</code>
              </dd>
            </div>
            <div>
              <dt>Block</dt>
              <dd>
                <span className="certificate-meta__value">
                  {anchor.block_number}
                </span>
              </dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>
                <span className="certificate-meta__value">
                  {formatTimestamp(anchor.block_time)}
                </span>
                <span className="certificate-meta__aside">
                  When the batch containing this file was anchored.
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <StatusMessage tone="warning" title="No anchor recorded">
            This certificate records the digest and root but has no transaction or
            block time, so nothing is anchored.
          </StatusMessage>
        )}
      </div>
      <div className="certificate-card__actions">
        <button type="button" className="button button--quiet" onClick={download}>
          Download certificate
        </button>
      </div>
    </section>
  );
}
