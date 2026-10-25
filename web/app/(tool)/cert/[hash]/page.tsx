import Link from "next/link";

import { CertificateDetail } from "@/components/CertificateDetail";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Timestamp</Link>
        <span className="breadcrumb__sep" aria-hidden="true">
          /
        </span>
        <Link href="/verify">Verify</Link>
        <span className="breadcrumb__sep" aria-hidden="true">
          /
        </span>
        <span aria-current="page">Certificate</span>
      </nav>

      <div className="page-intro page-intro--compact">
        <p className="eyebrow">Inspect / Certificate</p>
        <h1>Certificate detail</h1>
        <p className="lede">
          The record for one anchored file digest, loaded from the Etch server.
        </p>
      </div>

      <CertificateDetail hash={hash} />
    </>
  );
}
