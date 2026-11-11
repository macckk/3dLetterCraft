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
  width: number   // box short interior dim (W)
  depth: number   // box long interior dim  (D)
  height: number  // box wall height        (H)
  thickness: number
}

// Approximate an arc as polyline points (angle in radians, CW positive)
function arcPts(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
  steps: number,
): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / steps)
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

/**
 * Tuck-top mailer box die-cut.
 *
 * Template orientation: PORTRAIT (taller than wide).
 * Center strip width  = D  (box depth, long dimension)
 * Side walls width    = H  (box height, extends L and R of center)
 * Panel heights       = W  (box width, short dimension)
 * Wall strip heights  = H
 *
 * Top → bottom layout:
 *   [tuck tab]           D wide
 *   [lid face]           D wide × W tall
 *   [back wall / hinge]  D wide × H tall
 *   [body bottom]        D wide × W tall  ← side walls (H wide) extend L+R here
 *   [front wall]         D wide × H tall
 *   [glue flap]          D wide × glue_h tall
 */
export function computeMailerBox(p: MailerBoxParams): BoxTemplate2D {
  const { width: W, depth: D, height: H, thickness: T } = p

  // Tuck tab
  const tuck_h = Math.max(20, H * 0.70)
  const tuck_r  = Math.min(10, tuck_h * 0.30)   // rounded top corners

  // Lid corner ear flaps (small rounded flaps at corners of lid face, fold into box corners)
  const ear_w = Math.max(8, H * 0.40)
  const ear_h = Math.max(6, H * 0.28)
  const ear_r  = Math.min(ear_w, ear_h) * 0.55

  // Lock-slot notches cut into inner edge of side walls near top
  const lock_w = Math.max(8, H * 0.20)
  const lock_h = T + 1.5

  // Glue flap at bottom
  const glue_h = Math.max(10, H * 0.30)

  // ── X coordinates ─────────────────────────────────────────────────────────
  const x0 = 0           // left outer edge of left side wall
  const x1 = H           // left fold line (left of center strip)
  const x2 = H + D       // right fold line (right of center strip)
  const x3 = 2 * H + D   // right outer edge of right side wall

  // ── Y coordinates (top → bottom) ─────────────────────────────────────────
  const y0 = 0
  const y1 = tuck_h           // fold: tuck tab ↔ lid face
  const y2 = y1 + W           // fold: lid face ↔ back wall
  const y3 = y2 + H           // fold: back wall ↔ body bottom  (top of cross)
  const y4 = y3 + W           // fold: body bottom ↔ front wall (bottom of cross)
  const y5 = y4 + H           // fold: front wall ↔ glue flap
  const y6 = y5 + glue_h      // bottom edge

  const totalW = x3
  const totalH = y6

  // ── Outer cut outline (single closed path, clockwise) ─────────────────────
  const pts: Array<[number, number]> = []

  // 1. Tuck tab – top-left rounded corner
  for (const p of arcPts(x1 + tuck_r, y0 + tuck_r, tuck_r, Math.PI, Math.PI * 1.5, 5))
    pts.push(p)

  // 2. Tuck tab – top edge + top-right rounded corner
  pts.push([x2 - tuck_r, y0])
  for (const p of arcPts(x2 - tuck_r, y0 + tuck_r, tuck_r, Math.PI * 1.5, Math.PI * 2, 5))
    pts.push(p)

  // 3. Tuck tab – right side down to fold line y1
  pts.push([x2, y1])

  // 4. Right ear flap: small rounded bump extending right at (x2, y1)
  pts.push([x2 + ear_w, y1])
  // rounded outer-bottom corner of ear
  for (const p of arcPts(x2 + ear_w - ear_r, y1 + ear_h - ear_r, ear_r, 0, Math.PI * 0.5, 4))
    pts.push(p)
  pts.push([x2, y1 + ear_h])

  // 5. Right side of lid face, back wall, then top of right side wall
  pts.push([x2, y3])
  pts.push([x3, y3])

  // 6. Right side wall right edge and bottom
  pts.push([x3, y4])
  pts.push([x2, y4])

  // 7. Right side of front wall and glue flap
  pts.push([x2, y6])

  // 8. Bottom of glue flap
  pts.push([x1, y6])

  // 9. Left side of glue flap and front wall, then bottom of left side wall
  pts.push([x1, y4])
  pts.push([x0, y4])

  // 10. Left side wall left edge and top
  pts.push([x0, y3])
  pts.push([x1, y3])

  // 11. Left side of back wall and lid face up to left ear
  pts.push([x1, y1 + ear_h])

  // 12. Left ear flap: small rounded bump extending left at (x1, y1+ear_h)
  pts.push([x1 - ear_w + ear_r, y1 + ear_h])
  // rounded outer-bottom corner of ear (going CW = left then up)
  for (const p of arcPts(x1 - ear_w + ear_r, y1 + ear_h - ear_r, ear_r, Math.PI * 0.5, Math.PI, 4))
    pts.push(p)
  pts.push([x1 - ear_w, y1])
  pts.push([x1, y1])

  // 13. Left side of tuck tab back up to rounded top-left corner
  pts.push([x1, y0 + tuck_r])

  const cutOutline: Path2D = { points: pts, closed: true }

  // ── Lock-slot notches (small cuts in inner edge of side walls near top) ───
  const slotYTop = y3 + 3
  const slotLeft: Path2D = {
    points: [
      [x1 - lock_w, slotYTop],
      [x1,          slotYTop],
      [x1,          slotYTop + lock_h],
      [x1 - lock_w, slotYTop + lock_h],
    ],
    closed: true,
  }
  const slotRight: Path2D = {
    points: [
      [x2,          slotYTop],
      [x2 + lock_w, slotYTop],
      [x2 + lock_w, slotYTop + lock_h],
      [x2,          slotYTop + lock_h],
    ],
    closed: true,
  }

  const cutPaths: Path2D[] = [cutOutline, slotLeft, slotRight]

  // ── Score lines (fold lines) ───────────────────────────────────────────────
  const scorePaths: Path2D[] = [
    // Horizontal folds (center strip)
    { points: [[x1, y1], [x2, y1]], closed: false },  // tuck tab fold
    { points: [[x1, y2], [x2, y2]], closed: false },  // lid ↔ back wall
    { points: [[x1, y3], [x2, y3]], closed: false },  // back wall ↔ body bottom
    { points: [[x1, y4], [x2, y4]], closed: false },  // body bottom ↔ front wall
    { points: [[x1, y5], [x2, y5]], closed: false },  // front wall ↔ glue flap
    // Vertical folds (side wall fold lines)
    { points: [[x1, y3], [x1, y4]], closed: false },  // left side wall
    { points: [[x2, y3], [x2, y4]], closed: false },  // right side wall
  ]

  return { cutPaths, scorePaths, width: totalW, height: totalH }
}
