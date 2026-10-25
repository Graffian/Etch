export function SampleCertificate() {
  return (
    <div className="sample-cert" aria-label="Sample anchor receipt (illustrative)">
      <span className="sample-cert__tag">sample</span>
      <div className="sample-cert__chain">
        <span className="sample-cert__chain-title">anchored · Sepolia</span>
        <span className="sample-cert__chain-sub">block #6184321</span>
      </div>
      <dl className="sample-cert__rows">
        <div>
          <dt>File SHA-256</dt>
          <dd>56f3fd84a1c4…2bd7</dd>
        </div>
        <div>
          <dt>Merkle root</dt>
          <dd>a91f0944c0e1…7f6d</dd>
        </div>
        <div>
          <dt>Transaction</dt>
          <dd>0x7f3a…9c2e</dd>
        </div>
        <div>
          <dt>Anchored</dt>
          <dd>2026-10-26 04:11 UTC</dd>
        </div>
      </dl>
    </div>
  );
}
