import type { DistrictDef } from "../data/districts";
import type { Ruleset } from "../data/rulesets";

export interface DistrictResult {
  id: string;
  name: string;
  unlocked: boolean;
  finished: number;
  building: number;
  /** C(T): districts of this type completed or placed (building). */
  placedCount: number;
  /** Whether the next placement of this type is currently discounted. */
  discounted: boolean;
  discountRate: number;
  /** How many more empire-wide district completions are needed
   *  before this type's next placement becomes discounted. 0 if already discounted. */
  districtsNeededForNextDiscount: number;
  /** How many more consecutive placements of this type (starting now) would still be
   *  discounted, given the current B. 0 if not currently discounted. */
  discountsLeft: number;
}

export interface DiscountSummary {
  /** A: number of specialty district types unlocked. */
  districtTypesUnlocked: number;
  /** B: number of specialty districts completed. */
  totalCompleted: number;
  /** B / A, formatted for display. */
  averageLabel: string;
  /** Whether B >= A, the gating condition required before any discount can apply. */
  gatingMet: boolean;
  results: DistrictResult[];
}

export function computeDiscounts(
  districts: DistrictDef[],
  unlocked: Record<string, boolean>,
  finishedCounts: Record<string, number>,
  buildingCounts: Record<string, number>,
  ruleset: Ruleset,
): DiscountSummary {
  const a = districts.filter((d) => unlocked[d.id]).length;
  const b = districts.reduce((sum, d) => sum + (finishedCounts[d.id] ?? 0), 0);

  const gatingMet = a > 0 && b >= a;
  const averageLabel = a > 0 ? (b / a).toFixed(2) : "-";

  const results: DistrictResult[] = districts.map((d) => {
    const isUnlocked = unlocked[d.id] ?? false;
    const finished = finishedCounts[d.id] ?? 0;
    const building = buildingCounts[d.id] ?? 0;
    const placedCount = finished + building;
    const discountRate = d.reducedDiscountRate ? ruleset.reducedDiscount : ruleset.standardDiscount;

    if (!isUnlocked || a === 0) {
      return {
        id: d.id,
        name: d.name,
        unlocked: isUnlocked,
        finished,
        building,
        placedCount,
        discounted: false,
        discountRate,
        districtsNeededForNextDiscount: 0,
        discountsLeft: 0,
      };
    }

    // C(T) < B/A, compared via cross-multiplication to avoid float rounding.
    const discounted = gatingMet && placedCount * a < b;

    // Smallest B' such that placedCount * a < B' and B' >= a.
    const targetB = Math.max(placedCount * a + 1, a);
    const districtsNeededForNextDiscount = discounted ? 0 : Math.max(targetB - b, 0);

    // Largest C(T) (call it maxC) still satisfying maxC * a < b, i.e. maxC <= floor((b - 1) / a).
    const maxC = discounted ? Math.floor((b - 1) / a) : placedCount;
    const discountsLeft = discounted ? maxC - placedCount + 1 : 0;

    return {
      id: d.id,
      name: d.name,
      unlocked: isUnlocked,
      finished,
      building,
      placedCount,
      discounted,
      discountRate,
      districtsNeededForNextDiscount,
      discountsLeft,
    };
  });

  return { districtTypesUnlocked: a, totalCompleted: b, averageLabel, gatingMet, results };
}
