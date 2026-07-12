export interface Ruleset {
  id: string;
  name: string;
  /** Discount applied to standard discount-eligible districts. */
  standardDiscount: number;
  /** Discount applied to Government Plaza / Diplomatic Quarter. */
  reducedDiscount: number;
}

export const RULESETS: Ruleset[] = [
  { id: "vanilla", name: "Vanilla", standardDiscount: 0.4, reducedDiscount: 0.25 },
  { id: "bbg", name: "Better Balanced Game (BBG)", standardDiscount: 0.35, reducedDiscount: 0.2 },
];
