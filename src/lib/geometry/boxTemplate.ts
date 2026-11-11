export interface Path2D {
  points: Array<[number, number]>
  closed: boolean
}

export interface BoxTemplate2D {
  cutPaths: Path2D[]
  scorePaths: Path2D[]
  width: number
  height: number
}

export interface MailerBoxParams {
  width: number
  depth: number
  height: number
  thickness: number
}

function ellipseArc(
  cx: number, cy: number,
  rx: number, ry: number,
  startAngle: number, endAngle: number,
  steps: number,
): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / steps)
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return pts
}

export function computeMailerBox(p: MailerBoxParams): BoxTemplate2D {
  const { width: W, depth: D, height: H, thickness: T } = p

  // Tuck tab sits at top of lid panel; angled sides, straight top
  const tuck_h = Math.max(20, D * 0.75)
  const tuck_inset = Math.max(4, T + 2)   // narrowing on each side

  // Dust flaps: half-ellipse bulging outward from lid sides
  const df_w = Math.max(12, D * 0.5)       // how far they extend outward
  const df_ry = Math.min(D * 0.42, H * 0.4) // vertical half-radius

  // Glue flap at bottom of back wall
  const glue_h = Math.max(10, H * 0.3)

  // Lock-slot notches on inner edges of side walls (rectangular cuts)
  const lock_w = Math.min(14, D * 0.28)
  const lock_h = T + 1.5

  // ── X layout ─────────────────────────────────────────────────────────────
  // |  left side walls  |  center strip (W)  |  right side walls  |
  //  x0                 x1                   x2                    x3
  const x0 = 0
  const x1 = D
  const x2 = x1 + W
  const x3 = x2 + D

  // ── Y layout ─────────────────────────────────────────────────────────────
  // y0  ── top of tuck tab
  // y1  ── bottom of tuck tab / top of lid panel
  // y2  ── bottom of lid panel / top of front wall
  // y3  ── bottom of front wall / top of bottom panel
  // y4  ── bottom of bottom panel / top of back wall
  // y5  ── bottom of back wall
  // y6  ── bottom of glue flap
  const y0 = 0
  const y1 = tuck_h
  const y2 = y1 + D
  const y3 = y2 + H
  const y4 = y3 + D
  const y5 = y4 + H
  const y6 = y5 + glue_h

  const totalW = x3
  const totalH = y6

  // Tuck tab x positions (slightly narrower than lid)
  const tuck_xL = x1 + tuck_inset
  const tuck_xR = x2 - tuck_inset

  // Dust flap ellipse: centred horizontally in [y1, y2]
  const df_cy = (y1 + y2) / 2

  // ── Main cut outline (clockwise from top-left of tuck tab) ───────────────
  const pts: Array<[number, number]> = []

  // 1. Top of tuck tab (angled from lid edge to tuck_xL/R, straight across)
  pts.push([tuck_xL, y0])
  pts.push([tuck_xR, y0])

  // 2. Right angled side of tuck tab down to lid corner
  pts.push([x2, y1])

  // 3. Right dust flap: half-ellipse bulging right from x2
  //    goes from (x2, y1) → arc → (x2, y2)
  const dfPtsR = ellipseArc(x2, df_cy, df_w, df_ry, -Math.PI / 2, Math.PI / 2, 10)
  for (const pt of dfPtsR) pts.push(pt)

  // 4. Right edge of lid down to front wall level (already at x2 after arc)
  pts.push([x2, y2])

  // 5. Top of right front side wall
  pts.push([x3, y2])

  // 6. Right edge and bottom of right front side wall
  pts.push([x3, y3])
  pts.push([x2, y3])

  // 7. Right edge of bottom panel (no extension) down to back wall
  pts.push([x2, y4])

  // 8. Top of right back side wall
  pts.push([x3, y4])

  // 9. Right edge and bottom of right back side wall
  pts.push([x3, y5])
  pts.push([x2, y5])

  // 10. Right side of glue flap
  pts.push([x2, y6])

  // 11. Bottom of glue flap
  pts.push([x1, y6])

  // 12. Left side of glue flap back up
  pts.push([x1, y5])

  // 13. Bottom and left edge of left back side wall
  pts.push([x0, y5])
  pts.push([x0, y4])

  // 14. Top of left back side wall
  pts.push([x1, y4])

  // 15. Left edge of bottom panel up
  pts.push([x1, y3])

  // 16. Bottom and left edge of left front side wall
  pts.push([x0, y3])
  pts.push([x0, y2])

  // 17. Top of left front side wall
  pts.push([x1, y2])

  // 18. Left dust flap: half-ellipse bulging left from x1
  //     goes from (x1, y2) → arc → (x1, y1)
  const dfPtsL = ellipseArc(x1, df_cy, df_w, df_ry, Math.PI / 2, -Math.PI / 2, 10)
  for (const pt of dfPtsL) pts.push(pt)

  // 19. Left angled side of tuck tab back up to start
  pts.push([x1, y1])
  pts.push([tuck_xL, y0])

  const cutOutline: Path2D = { points: pts, closed: true }

  // ── Lock-slot notches (small rectangular cuts into inner side wall edges) ─
  // On inner edge (x1 side) of RIGHT front side wall, near top (y2)
  const slotRF: Path2D = {
    points: [
      [x2, y2 + 3],
      [x2 + lock_w, y2 + 3],
      [x2 + lock_w, y2 + 3 + lock_h],
      [x2, y2 + 3 + lock_h],
    ],
    closed: true,
  }
  // On inner edge (x2 side) of LEFT front side wall, near top
  const slotLF: Path2D = {
    points: [
      [x1 - lock_w, y2 + 3],
      [x1, y2 + 3],
      [x1, y2 + 3 + lock_h],
      [x1 - lock_w, y2 + 3 + lock_h],
    ],
    closed: true,
  }

  const cutPaths: Path2D[] = [cutOutline, slotRF, slotLF]

  // ── Score lines (fold lines) ──────────────────────────────────────────────
  const scorePaths: Path2D[] = [
    // Lid fold line
    { points: [[x1, y1], [x2, y1]], closed: false },
    // Bottom of lid / top of front wall
    { points: [[x1, y2], [x2, y2]], closed: false },
    // Bottom of front wall / top of bottom panel
    { points: [[x1, y3], [x2, y3]], closed: false },
    // Bottom of bottom panel / top of back wall
    { points: [[x1, y4], [x2, y4]], closed: false },
    // Bottom of back wall / top of glue flap
    { points: [[x1, y5], [x2, y5]], closed: false },
    // Left fold lines for front side walls
    { points: [[x1, y2], [x1, y3]], closed: false },
    // Right fold lines for front side walls
    { points: [[x2, y2], [x2, y3]], closed: false },
    // Left fold lines for back side walls
    { points: [[x1, y4], [x1, y5]], closed: false },
    // Right fold lines for back side walls
    { points: [[x2, y4], [x2, y5]], closed: false },
  ]

  return { cutPaths, scorePaths, width: totalW, height: totalH }
}
