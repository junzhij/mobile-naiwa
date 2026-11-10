export function FrogIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? "frog-svg frog-svg-compact" : "frog-svg"} viewBox="0 0 540 550" role="img" aria-label="原创黄色奶蛙立牌插画">
      <defs>
        <radialGradient id="frogYellow" cx="38%" cy="27%" r="75%"><stop stopColor="#fff190"/><stop offset="0.55" stopColor="#ffdf58"/><stop offset="1" stopColor="#f6bb3f"/></radialGradient>
        <radialGradient id="frogBelly" cx="40%" cy="32%" r="70%"><stop stopColor="#fff9d2"/><stop offset="1" stopColor="#f8e9a0"/></radialGradient>
        <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffffff" stopOpacity=".85"/><stop offset="1" stopColor="#c6d8ca" stopOpacity=".8"/></linearGradient>
        <filter id="softShadow"><feGaussianBlur stdDeviation="16"/></filter>
      </defs>
      <ellipse cx="270" cy="506" rx="170" ry="23" fill="#385445" opacity=".16" filter="url(#softShadow)"/>
      <g className="frog-character">
        <path d="M175 377 Q118 403 132 445 Q140 467 174 452 L212 422Z" fill="#edb13e"/>
        <path d="M371 378 Q424 401 413 443 Q406 462 375 451 L335 420Z" fill="#eeb23e"/>
        <path d="M202 386 Q199 466 225 472 Q244 480 254 456 L256 417Z" fill="#f8c545"/>
        <path d="M336 386 Q342 463 316 472 Q297 478 286 456 L284 417Z" fill="#efb944"/>
        <path d="M137 190 C121 130 151 91 211 76 C255 65 309 69 347 85 C398 104 414 146 401 191 C427 248 427 344 386 403 C359 443 311 460 269 459 C218 459 171 438 145 398 C110 341 110 249 137 190Z" fill="url(#frogYellow)" stroke="#dcaa38" strokeWidth="4"/>
        <ellipse cx="273" cy="323" rx="98" ry="108" fill="url(#frogBelly)" opacity=".95"/>
        <path d="M144 253 C118 276 107 319 120 353 C132 380 155 378 170 357 L194 320" fill="url(#frogYellow)" stroke="#dfa93e" strokeWidth="4"/>
        <path d="M397 251 C425 269 440 306 430 342 C425 361 407 374 391 363 L359 323" fill="url(#frogYellow)" stroke="#dfa93e" strokeWidth="4"/>
        <path d="M154 334 Q148 359 167 362 Q185 364 194 342" fill="none" stroke="#e7b447" strokeWidth="5" strokeLinecap="round"/>
        <path d="M390 338 Q397 356 415 350" fill="none" stroke="#e3ad40" strokeWidth="5" strokeLinecap="round"/>
        <ellipse cx="208" cy="176" rx="45" ry="52" fill="#bfdc83" stroke="#8cac58" strokeWidth="4"/>
        <ellipse cx="333" cy="174" rx="45" ry="52" fill="#bfdc83" stroke="#8cac58" strokeWidth="4"/>
        <ellipse cx="214" cy="175" rx="27" ry="34" fill="#234337"/>
        <ellipse cx="332" cy="173" rx="27" ry="34" fill="#234337"/>
        <circle cx="223" cy="164" r="9" fill="white" opacity=".95"/>
        <circle cx="340" cy="161" r="9" fill="white" opacity=".95"/>
        <circle cx="201" cy="188" r="4" fill="white" opacity=".58"/>
        <circle cx="322" cy="186" r="4" fill="white" opacity=".58"/>
        <path d="M252 235 Q270 248 289 234" fill="none" stroke="#a1672f" strokeWidth="5" strokeLinecap="round"/>
        <ellipse cx="180" cy="234" rx="18" ry="8" fill="#ef9c6b" opacity=".45"/>
        <ellipse cx="364" cy="231" rx="18" ry="8" fill="#ef9c6b" opacity=".45"/>
        <path d="M119 336 Q101 325 92 338 M423 336 Q439 323 450 333" fill="none" stroke="#e1aa3b" strokeWidth="10" strokeLinecap="round"/>
      </g>
      <path d="M157 470 L381 470 L402 502 Q403 509 394 510 L145 510 Q137 509 140 501Z" fill="url(#base)" stroke="#abc5b7" strokeWidth="3" opacity=".88"/>
      <path d="M200 475 L335 475" stroke="white" strokeWidth="5" opacity=".8" strokeLinecap="round"/>
    </svg>
  );
}
