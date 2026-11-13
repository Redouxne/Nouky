export default function SunprintArtwork({ compact = false }) {
  return (
    <div className={`sunprint-art ${compact ? "sunprint-art-compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 600 480" role="presentation" focusable="false">
        <defs>
          <pattern id="paper-grain" width="11" height="11" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="0.7" fill="#315b4e" opacity=".17" />
            <circle cx="8" cy="9" r="0.55" fill="#bb765b" opacity=".16" />
          </pattern>
          <clipPath id="art-edge"><rect x="0" y="0" width="600" height="480" rx="28" /></clipPath>
        </defs>
        <g clipPath="url(#art-edge)">
          <rect width="600" height="480" fill="#e8efe3" />
          <circle cx="451" cy="117" r="70" fill="#f2d6a6" />
          <circle cx="451" cy="117" r="51" fill="#f8e8c5" />
          <path d="M-12 395c95-49 167-17 255-48 89-32 170-74 369-10v160H-12Z" fill="#d0e0cf" />
          <path d="M-10 431c86-41 163-15 248-42 112-34 222-50 371-8v120H-10Z" fill="#b7d0bc" />

          {/* A printed open study book. */}
          <path d="M115 284c66-33 126-30 183-2 58-28 121-31 186 2l-12 112c-67-24-119-18-174 10-58-29-111-34-174-10Z" fill="#2d594b" />
          <path d="M123 278c64-27 120-24 175 4v118c-54-28-110-37-175-11Z" fill="#fbf4e7" />
          <path d="M298 282c56-28 114-31 178-4v111c-65-26-122-17-178 11Z" fill="#f5ead8" />
          <path d="M298 282v118" stroke="#8cae96" strokeWidth="3" />
          <path d="M147 309c39-10 81-7 123 8M147 327c39-10 81-7 123 8M147 345c39-10 81-7 123 8M322 318c41-16 86-20 125-10M322 337c41-16 86-20 125-10M322 356c41-16 86-20 125-10" stroke="#9ab5a4" strokeWidth="4" strokeLinecap="round" opacity=".8" />
          <path d="M355 273v52m-26-26h52" stroke="#bc775d" strokeWidth="9" strokeLinecap="round" />

          {/* A laboratory flask and a small stem keep the medical cue subtle. */}
          <path d="M189 101h77m-56 0v60l-38 68c-10 19 2 36 24 36h70c22 0 34-17 24-36l-38-68v-60" fill="#e2ece1" stroke="#2e6758" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M186 221c32-10 58-11 90 0l15 28H170Z" fill="#7cae9c" />
          <circle cx="224" cy="191" r="6" fill="#b8775e" /><circle cx="246" cy="208" r="4" fill="#f3d7a8" />
          <path d="M508 312c-17-77-7-128 15-169" fill="none" stroke="#2e6758" strokeWidth="8" strokeLinecap="round" />
          <path d="M516 211c-35-28-44-51-37-73 31 8 45 30 37 73ZM512 257c21-39 41-50 61-47-8 33-29 50-61 47ZM507 299c-30-29-38-51-29-72 29 10 40 32 29 72Z" fill="#6fa78f" />
          <path d="M64 177c21-18 42-19 63-2M72 192c15-10 31-10 47 0" fill="none" stroke="#bc775d" strokeWidth="5" strokeLinecap="round" opacity=".8" />
          <rect width="600" height="480" fill="url(#paper-grain)" opacity=".75" />
        </g>
      </svg>
      <span className="sunprint-art-stamp">Apprendre · pratiquer · progresser</span>
    </div>
  );
}
