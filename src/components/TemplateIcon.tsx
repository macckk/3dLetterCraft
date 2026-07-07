/**
 * Decorative SVG previews for each template shown on the landing gallery.
 * Kept intentionally simple + inline so no assets/fetches are needed.
 */
export function TemplateIcon({ id }: { id: string }) {
  switch (id) {
    case 'name-with-script':  return <NameWithScriptIcon />
    case 'couple-initials':   return <CoupleInitialsIcon />
    case 'heart-with-name':   return <HeartWithNameIcon />
    case 'cake-topper':       return <CakeTopperIcon />
    case 'name-keychain':     return <NameKeychainIcon />
    default:                  return <FallbackIcon />
  }
}

const VIEW = '0 0 200 150'

function NameWithScriptIcon() {
  return (
    <svg viewBox={VIEW} className="w-full h-full">
      <rect x={20} y={30} width={160} height={90} rx={4} fill="#3a3a3a" />
      <text x={100} y={95} textAnchor="middle" fontFamily="'Georgia', serif" fontSize={82} fontWeight={600} fill="#F5F0E1">
        N
      </text>
      <text x={100} y={104} textAnchor="middle" fontFamily="'Brush Script MT', cursive" fontSize={40} fill="#D62828" style={{ fontStyle: 'italic' }}>
        name
      </text>
      <rect x={20} y={120} width={160} height={12} rx={2} fill="#8C6A45" />
    </svg>
  )
}

function CoupleInitialsIcon() {
  return (
    <svg viewBox={VIEW} className="w-full h-full">
      <text x={100} y={95} textAnchor="middle" fontFamily="'Georgia', serif" fontSize={68} fontWeight={600} fill="#F5F0E1">
        M
        <tspan dx={6} fill="#D62828" fontStyle="italic">&amp;</tspan>
        <tspan dx={6}>J</tspan>
      </text>
      <rect x={16} y={110} width={168} height={14} rx={2} fill="#8C6A45" />
    </svg>
  )
}

function HeartWithNameIcon() {
  // Same parametric heart used in the geometry, sampled into an SVG path.
  const pts: string[] = []
  const cx = 100
  const cy = 75
  const scale = 4.2
  const samples = 96
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    // SVG Y is inverted (down positive), so negate
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    pts.push(`${(cx + x * scale).toFixed(1)},${(cy + y * scale).toFixed(1)}`)
  }
  return (
    <svg viewBox={VIEW} className="w-full h-full">
      <polygon points={pts.join(' ')} fill="#D62828" />
      <text x={100} y={92} textAnchor="middle" fontFamily="'Brush Script MT', cursive" fontSize={30} fill="#F5F0E1" style={{ fontStyle: 'italic' }}>
        amor
      </text>
      <circle cx={100} cy={30} r={4} fill="#111" />
    </svg>
  )
}

function CakeTopperIcon() {
  return (
    <svg viewBox={VIEW} className="w-full h-full">
      <text x={100} y={62} textAnchor="middle" fontFamily="'Brush Script MT', cursive" fontSize={38} fill="#E5B84B" style={{ fontStyle: 'italic' }}>
        Ana
      </text>
      <rect x={40} y={72} width={120} height={5} rx={1.5} fill="#E5B84B" />
      <rect x={62} y={75} width={4} height={45} fill="#E5B84B" />
      <rect x={134} y={75} width={4} height={45} fill="#E5B84B" />
      <path d="M 30 130 Q 100 110 170 130" stroke="#5a2a2a" strokeWidth={3} fill="none" opacity={0.5} />
    </svg>
  )
}

function NameKeychainIcon() {
  // Rounded red plate with a circular lobe/hole on the left + white "Name" text.
  return (
    <svg viewBox={VIEW} className="w-full h-full">
      {/* Lobe circle (behind plate) */}
      <circle cx={42} cy={75} r={24} fill="#D62828" />
      {/* Main plate body */}
      <rect x={54} y={51} width={130} height={48} rx={10} fill="#D62828" />
      {/* Keyring hole */}
      <circle cx={42} cy={75} r={8} fill="#111" />
      {/* Name text (raised, white with subtle outline) */}
      <text
        x={122}
        y={86}
        textAnchor="middle"
        fontFamily="'Poppins', 'Helvetica', sans-serif"
        fontSize={30}
        fontWeight={700}
        fill="#F5F0E1"
        stroke="#111"
        strokeWidth={1}
        paintOrder="stroke"
      >
        Name
      </text>
    </svg>
  )
}

function FallbackIcon() {
  return (
    <svg viewBox={VIEW} className="w-full h-full">
      <text x={100} y={95} textAnchor="middle" fontSize={64} fill="#666">★</text>
    </svg>
  )
}
