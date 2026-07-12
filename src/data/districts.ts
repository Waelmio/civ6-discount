export interface DistrictDef {
  id: string;
  name: string;
  image: string;
  /** Can only ever have one copy built (e.g. Government Plaza, Diplomatic Quarter). */
  singleBuild?: boolean;
  /** Gets the reduced (Government Plaza style) discount rate instead of the standard rate. */
  reducedDiscountRate?: boolean;
}

export const DISTRICTS: DistrictDef[] = [
  { id: "campus", name: "Campus", image: "/districts/campus.png" },
  { id: "holy-site", name: "Holy Site", image: "/districts/holy-site.png" },
  { id: "commercial-hub", name: "Commercial Hub", image: "/districts/commercial-hub.png" },
  { id: "harbor", name: "Harbor", image: "/districts/harbor.png" },
  { id: "theater-square", name: "Theater Square", image: "/districts/theater-square.png" },
  { id: "industrial-zone", name: "Industrial Zone", image: "/districts/industrial-zone.png" },
  { id: "encampment", name: "Encampment", image: "/districts/encampment.png" },
  { id: "aerodrome", name: "Aerodrome", image: "/districts/aerodrome.png" },
  {
    id: "entertainment-complex",
    name: "Entertainment Complex",
    image: "/districts/entertainment-complex.png",
  },
  { id: "water-park", name: "Water Park", image: "/districts/water-park.png" },
  {
    id: "diplomatic-quarter",
    name: "Diplomatic Quarter",
    image: "/districts/diplomatic-quarter.png",
    singleBuild: true,
    reducedDiscountRate: true,
  },
  {
    id: "government-plaza",
    name: "Government Plaza",
    image: "/districts/government-plaza.png",
    singleBuild: true,
    reducedDiscountRate: true,
  },
];
