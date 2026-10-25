export function MerkleViz() {
  return (
    <svg
      viewBox="0 0 660 340"
      className="merkle-viz"
      role="img"
      aria-label="Four file hashes combine pairwise into two nodes, then a single Merkle root, which is anchored to a chain block"
    >
      {/* connecting edges */}
      <g className="edge">
        <path d="M90 278 L170 218" />
        <path d="M250 278 L170 218" />
        <path d="M410 278 L490 218" />
        <path d="M570 278 L490 218" />
        <path d="M170 184 L330 134" />
        <path d="M490 184 L330 134" />
        <path d="M330 100 L330 52" />
      </g>

      {/* chain block */}
      <g className="chain">
        <rect x="190" y="14" width="280" height="38" rx="5" />
        <text x="330" y="30" textAnchor="middle" className="chain-title">
          anchored · block #1
        </text>
        <text x="330" y="46" textAnchor="middle" className="chain-sub">
          2026-10-25T17:37Z
        </text>
      </g>

      {/* root */}
      <text x="330" y="92" textAnchor="middle" className="label">
        merkle root
      </text>
      <g className="node">
        <rect x="257.5" y="100" width="145" height="34" rx="5" />
        <text x="330" y="122" textAnchor="middle" className="hash">
          a91f0944…7f6d
        </text>
      </g>

      {/* parent nodes */}
      <text x="330" y="176" textAnchor="middle" className="label">
        combine
      </text>
      <g className="node">
        <rect x="97.5" y="184" width="145" height="34" rx="5" />
        <text x="170" y="206" textAnchor="middle" className="hash">
          8ca16456…50f2
        </text>
      </g>
      <g className="node">
        <rect x="417.5" y="184" width="145" height="34" rx="5" />
        <text x="490" y="206" textAnchor="middle" className="hash">
          97b38706…a78c
        </text>
      </g>

      {/* leaves */}
      <g>
        <text x="90" y="270" textAnchor="middle" className="file file--accent">
          invoice.pdf
        </text>
        <text x="250" y="270" textAnchor="middle" className="file">
          logo.png
        </text>
        <text x="410" y="270" textAnchor="middle" className="file">
          code.zip
        </text>
        <text x="570" y="270" textAnchor="middle" className="file">
          notes.md
        </text>
      </g>

      <g className="node node--accent">
        <rect x="17.5" y="278" width="145" height="34" rx="5" />
        <text x="90" y="300" textAnchor="middle" className="hash">
          56f3fd84…2bd7
        </text>
      </g>
      <g className="node">
        <rect x="177.5" y="278" width="145" height="34" rx="5" />
        <text x="250" y="300" textAnchor="middle" className="hash">
          c147efcf…9f31
        </text>
      </g>
      <g className="node">
        <rect x="337.5" y="278" width="145" height="34" rx="5" />
        <text x="410" y="300" textAnchor="middle" className="hash">
          3377870d…a92f
        </text>
      </g>
      <g className="node">
        <rect x="497.5" y="278" width="145" height="34" rx="5" />
        <text x="570" y="300" textAnchor="middle" className="hash">
          6f3fef6d…95b0
        </text>
      </g>

      <text x="90" y="330" textAnchor="middle" className="tag">
        your file
      </text>
    </svg>
  );
}
