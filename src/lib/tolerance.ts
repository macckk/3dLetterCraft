// 3D printing clearance constants (mm).
// All templates that mate two pieces MUST use these when generating pockets.
export const TOLERANCE_DEFAULT = 0.2 // per-side clearance
export const TOLERANCE_MIN = 0.0
export const TOLERANCE_MAX = 0.6
export const TOLERANCE_STEP = 0.05

export function inflateForFit(nominal: number, tol = TOLERANCE_DEFAULT) {
  return nominal + tol * 2
}
