// Tired of Cancer logo — climbing figure on yellow→green bars.
// Inline SVG so it works without shipping a binary. If a public/logo.png
// is dropped in by design, swap the SVG body for <img src="/logo.png" .../>.

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

export default function Logo({ size = 40, withWordmark = false, className = '' }: LogoProps) {
  const h = size;
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={h}
        height={h}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Tired of Cancer"
      >
        {/* Five bars, ascending, yellow → dark green */}
        <rect x="2"  y="42" width="10" height="20" rx="5" fill="#EFE13A" />
        <rect x="14" y="34" width="10" height="28" rx="5" fill="#C9D43A" />
        <rect x="26" y="26" width="10" height="36" rx="5" fill="#7EBE3E" />
        <rect x="38" y="18" width="10" height="44" rx="5" fill="#43A847" />
        <rect x="50" y="10" width="10" height="52" rx="5" fill="#1F7A36" />

        {/* Climbing stick figure */}
        <g fill="#1F2937">
          {/* Head */}
          <circle cx="30" cy="14" r="4" />
          {/* Body */}
          <path d="M30 18 L29 30" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
          {/* Front (climbing) leg */}
          <path d="M30 30 L36 24" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
          {/* Back leg */}
          <path d="M30 30 L24 36" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
          {/* Front arm reaching up */}
          <path d="M30 22 L37 17" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
          {/* Back arm */}
          <path d="M30 22 L24 25" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      </svg>
      {withWordmark && (
        <span className="font-semibold text-gray-900 leading-tight">
          Tired<span className="text-[#EFE13A]">of</span>Cancer
        </span>
      )}
    </div>
  );
}
