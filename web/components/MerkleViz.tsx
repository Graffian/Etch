export function MerkleViz() {
  return (
    <svg
      viewBox="0 0 720 368"
      className="merkle-viz"
      role="img"
      aria-label="Four file hashes combine pairwise into two nodes, then a single Merkle root, which is anchored to a chain block"
    >
      {/* connecting edges */}
      <g className="edge">
        <path d="M110 296 L192 238" />
        <path d="M275 296 L192 238" />
        <path d="M440 296 L522 238" />
        <path d="M605 296 L522 238" />
        <path d="M192 204 L357 146" />
        <path d="M522 204 L357 146" />
        <path d="M357 112 L357 64" />
      </g>

      {/* chain block */}
      <g className="chain">
        <rect x="207" y="24" width="300" height="40" rx="5" />
        <text x="357" y="40" textAnchor="middle" className="chain-title">
          anchored · block #1
        </text>
        <text x="357" y="56" textAnchor="middle" className="chain-sub">
          2026-10-25T17:37Z
        </text>
      </g>

      {/* root */}
      <text x="357" y="104" textAnchor="middle" className="label">
        merkle root
      </text>
      <g className="node">
        <rect x="292" y="112" width="130" height="34" rx="5" />
        <text x="357" y="134" textAnchor="middle" className="hash">
          a91f0944…7397f6
        </text>
      </g>

      {/* parent nodes */}
      <text x="357" y="196" textAnchor="middle" className="label">
        combine
      </text>
      <g className="node">
        <rect x="127" y="204" width="130" height="34" rx="5" />
        <text x="192" y="226" textAnchor="middle" className="hash">
          8ca16456…a8050f
        </text>
      </g>
      <g className="node">
        <rect x="457" y="204" width="130" height="34" rx="5" />
        <text x="522" y="226" textAnchor="middle" className="hash">
          97b38706…75ea78
        </text>
      </g>

      {/* leaves */}
      <g>
        <text x="110" y="288" textAnchor="middle" className="file file--accent">
          invoice.pdf
        </text>
        <text x="275" y="288" textAnchor="middle" className="file">
          logo.png
        </text>
        <text x="440" y="288" textAnchor="middle" className="file">
          code.zip
        </text>
        <text x="605" y="288" textAnchor="middle" className="file">
          notes.md
        </text>
      </g>

      <g className="node node--accent">
        <rect x="45" y="296" width="130" height="34" rx="5" />
        <text x="110" y="318" textAnchor="middle" className="hash">
          56f3fd84…992bd7
        </text>
      </g>
      <g className="node">
        <rect x="210" y="296" width="130" height="34" rx="5" />
        <text x="275" y="318" textAnchor="middle" className="hash">
          c147efcf…fc9f31
        </text>
      </g>
      <g className="node">
        <rect x="375" y="296" width="130" height="34" rx="5" />
        <text x="440" y="318" textAnchor="middle" className="hash">
          3377870d…44a92f
        </text>
      </g>
      <g className="node">
        <rect x="540" y="296" width="130" height="34" rx="5" />
        <text x="605" y="318" textAnchor="middle" className="hash">
          6f3fef6d…95bb02
        </text>
      </g>

      <text x="110" y="348" textAnchor="middle" className="tag">
        your file
      </text>
    </svg>
  );
}
