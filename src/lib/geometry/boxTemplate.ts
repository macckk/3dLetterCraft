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

export function computeMailerBox(p: MailerBoxParams): BoxTemplate2D {
  const { width: W, depth: D, height: H, thickness: T } = p

  const Wo = W + 2 * T
  const Do = D + 2 * T
  const Ho = H + T

  // Tuck tab dimensions
  const tab_h = Math.max(15, H * 0.5)
  const tab_w = Wo * 0.28
  const tab_gap = Wo * 0.08
  const tab_total = 2 * tab_w + tab_gap
  const tab_x_offset = (Wo - tab_total) / 2

  // Dust flap (attached to left/right sides of lid, folds inside the box)
  const df_w = Math.max(5, D / 2 - T)
  const df_h = Do - T

  // Side wall width (= box height when folded up)
  const sw_w = Ho

  // X coordinates
  const x_cl = sw_w
  const x_cr = x_cl + Wo

  // Tuck tab absolute x positions
  const tab_x1_L = x_cl + tab_x_offset
  const tab_x1_R = tab_x1_L + tab_w
  const tab_x2_L = tab_x1_R + tab_gap
  const tab_x2_R = tab_x2_L + tab_w

  // Y coordinates
  const y0 = 0              // top of tuck tabs
  const y1 = tab_h          // top of lid panel
  const y2 = y1 + Do        // top of back wall
  const y3 = y2 + Ho        // top of bottom panel
  const y4 = y3 + Do        // top of front wall
  const y5 = y4 + Ho        // bottom edge

  // Lock slot dimensions (cut into front wall)
  const slot_w = tab_w + 1
  const slot_h = T + 0.5
  const slot_y = y4 + 3

  const totalW = 2 * sw_w + Wo
  const totalH = y5

  // Cut outline: clockwise from top-left of lid panel
  const cutOutline: Array<[number, number]> = [
    [x_cl, y1],
    [tab_x1_L, y1],
    [tab_x1_L, y0],
    [tab_x1_R, y0],
    [tab_x1_R, y1],
    [tab_x2_L, y1],
    [tab_x2_L, y0],
    [tab_x2_R, y0],
    [tab_x2_R, y1],
    [x_cr, y1],
    [x_cr, y2 - df_h],
    [x_cr + df_w, y2 - df_h],
    [x_cr + df_w, y2],
    [x_cr, y2],
    [x_cr, y3],
    [x_cr + sw_w, y3],
    [x_cr + sw_w, y4],
    [x_cr, y4],
    [x_cr, y5],
    [x_cl, y5],
    [x_cl, y4],
    [x_cl - sw_w, y4],
    [x_cl - sw_w, y3],
    [x_cl, y3],
    [x_cl, y2],
    [x_cl - df_w, y2],
    [x_cl - df_w, y2 - df_h],
    [x_cl, y2 - df_h],
  ]

  // Lock slots (rectangular cuts in front wall)
  const slot1: Path2D = {
    points: [
      [tab_x1_L, slot_y],
      [tab_x1_L + slot_w, slot_y],
      [tab_x1_L + slot_w, slot_y + slot_h],
      [tab_x1_L, slot_y + slot_h],
    ],
    closed: true,
  }
  const slot2: Path2D = {
    points: [
      [tab_x2_L - 0.5, slot_y],
      [tab_x2_L - 0.5 + slot_w, slot_y],
      [tab_x2_L - 0.5 + slot_w, slot_y + slot_h],
      [tab_x2_L - 0.5, slot_y + slot_h],
    ],
    closed: true,
  }

  const cutPaths: Path2D[] = [
    { points: cutOutline, closed: true },
    slot1,
    slot2,
  ]

  const scorePaths: Path2D[] = [
    // Horizontal folds (center column)
    { points: [[x_cl, y2], [x_cr, y2]], closed: false },
    { points: [[x_cl, y3], [x_cr, y3]], closed: false },
    { points: [[x_cl, y4], [x_cr, y4]], closed: false },
    // Vertical folds: dust flaps
    { points: [[x_cl, y2 - df_h], [x_cl, y2]], closed: false },
    { points: [[x_cr, y2 - df_h], [x_cr, y2]], closed: false },
    // Vertical folds: side walls
    { points: [[x_cl, y3], [x_cl, y4]], closed: false },
    { points: [[x_cr, y3], [x_cr, y4]], closed: false },
  ]

  return { cutPaths, scorePaths, width: totalW, height: totalH }
}
