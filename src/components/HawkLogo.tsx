/**
 * CardHawk AI logo: a hawk with wings spread, gripping a card marked "$".
 * Original artwork (Option A, 14 Oct 2026). The same drawing is used for the app icons in /public.
 */
export default function HawkLogo({ className, framed = false }: { className?: string; framed?: boolean }) {
  return (
    <svg
      viewBox={framed ? "40 40 432 432" : "78 94 356 356"}
      className={className}
      role="img"
      aria-label="CardHawk AI"
    >
      {framed && (
        <rect x="56" y="56" width="400" height="400" rx="96" fill="#0d1a12" stroke="#22c55e" strokeOpacity=".55" strokeWidth="10" />
      )}
      <g fill="#22c55e">
      <path d="M238 196 C206 168 166 132 112 104 L124 134 L96 132 L118 158 L88 162 L116 184 L88 194 L122 210 L100 226 L140 232 L128 252 L176 248 L170 266 L236 246 Z"/>
      <path d="M274 196 C306 168 346 132 400 104 L388 134 L416 132 L394 158 L424 162 L396 184 L424 194 L390 210 L412 226 L372 232 L384 252 L336 248 L342 266 L276 246 Z"/>
      <path d="M238 282 L214 336 L232 330 L240 344 L256 330 L272 344 L280 330 L298 336 L274 282 Z"/>
      <path d="M232 176 C246 166 266 166 280 176 C292 206 292 250 280 284 C272 300 240 300 232 284 C220 250 220 206 232 176 Z"/>
      <path d="M236 172 C232 146 246 124 270 120 C290 118 304 126 312 136 L330 142 C336 146 334 156 326 160 L314 156 C306 166 292 172 278 176 Z"/>
      </g>
      <path d="M268 136 L296 140" stroke="#0d1a12" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="288" cy="147" r="5.5" fill="#0d1a12"/>
      <path d="M312 136 C330 134 342 144 340 160 C334 154 328 154 322 158 L314 154 Z" fill="#facc15"/>
      <g transform="translate(256 382) rotate(-6)"><rect x="-44" y="-60" width="88" height="120" rx="9" fill="#e6ebf2"/>
      <rect x="-35" y="-51" width="70" height="74" rx="4" fill="#0d1a12"/>
      <text x="0" y="0" textAnchor="middle" dominantBaseline="central" transform="translate(0 -14)" fontFamily="Helvetica, Arial, sans-serif" fontWeight="800" fontSize="62" fill="#22c55e">$</text>
      <rect x="-35" y="32" width="46" height="7" rx="3.5" fill="#080b10" opacity=".35"/>
      <rect x="-35" y="44" width="30" height="7" rx="3.5" fill="#080b10" opacity=".2"/></g>
      <g stroke="#facc15" strokeWidth="7" strokeLinecap="round" fill="none">
      <path d="M242 292 L238 322"/><path d="M270 292 L274 320"/>
      <path d="M226 330 C228 320 236 318 242 324"/><path d="M238 334 C238 322 246 320 250 326"/>
      <path d="M262 324 C266 316 276 316 280 324"/><path d="M274 326 C280 318 290 320 290 330"/>
      </g>
    </svg>
  );
}
