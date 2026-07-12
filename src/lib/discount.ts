import type { DistrictDef } from "../data/districts";
import type { Ruleset } from "../data/rulesets";

export interface DistrictResult {
  id: string;
  name: string;
  unlocked: boolean;
  finished: number;
  /** Whether the next district of this type is currently discounted. */
  discounted: boolean;
  discountRate: number;
  /** How many more empire-wide district completions (of any type) are needed
   *  before this type's next copy becomes discounted. 0 if already discounted. */
  districtsNeededForNextDiscount: number;
}

export interface DiscountSummary {
  districtTypesUnlocked: number;
  totalDistrictsBuilt: number;
  average: number;
  results: DistrictResult[];
}

export function computeDiscounts(
  districts: DistrictDef[],
  unlocked: Record<string, boolean>,
  finishedCounts: Record<string, number>,
  ruleset: Ruleset,
): DiscountSummary {
  const districtTypesUnlocked = districts.filter((d) => unlocked[d.id]).length;
  const totalDistrictsBuilt = districts.reduce((sum, d) => sum + (finishedCounts[d.id] ?? 0), 0);

  const average =
    districtTypesUnlocked > 0 ? Math.ceil(totalDistrictsBuilt / districtTypesUnlocked) : 0;

  const gatingMet = districtTypesUnlocked > 0 && totalDistrictsBuilt >= districtTypesUnlocked;

  const results: DistrictResult[] = districts.map((d) => {
    const isUnlocked = unlocked[d.id] ?? false;
    const finished = finishedCounts[d.id] ?? 0;
    const discountRate = d.reducedDiscountRate ? ruleset.reducedDiscount : ruleset.standardDiscount;

    if (!isUnlocked || districtTypesUnlocked === 0) {
      return {
        id: d.id,
        name: d.name,
        unlocked: isUnlocked,
        finished,
        discounted: false,
        discountRate,
        districtsNeededForNextDiscount: 0,
      };
    }

    const discounted = gatingMet && finished < average;

    // Smallest totalDistrictsBuilt (call it T) such that ceil(T / types) > finished,
    // i.e. T > finished * types. Smallest integer T is finished*types + 1.
    // Also need T >= types for the gate. Needed additional built = T - totalDistrictsBuilt.
    const targetTotal = Math.max(finished * districtTypesUnlocked + 1, districtTypesUnlocked);
    const districtsNeededForNextDiscount = discounted
      ? 0
      : Math.max(targetTotal - totalDistrictsBuilt, 0);

    return {
      id: d.id,
      name: d.name,
      unlocked: isUnlocked,
      finished,
      discounted,
      discountRate,
      districtsNeededForNextDiscount,
    };
  });

  return { districtTypesUnlocked, totalDistrictsBuilt, average, results };
}
