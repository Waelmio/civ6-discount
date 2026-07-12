export interface DistrictDef {
  id: string;
  name: string;
  image: string;
  /** Can only ever have one copy built (e.g. Government Plaza, Diplomatic Quarter). */
  singleBuild?: boolean;
  /** Gets the reduced (Government Plaza style) discount rate instead of the standard rate. */
  reducedDiscountRate?: boolean;
}

const districtImage = (file: string) => `${import.meta.env.BASE_URL}districts/${file}`;

export const DISTRICTS: DistrictDef[] = [
  { id: "campus", name: "Campus", image: districtImage("campus.png") },
  { id: "holy-site", name: "Holy Site", image: districtImage("holy-site.png") },
  { id: "commercial-hub", name: "Commercial Hub", image: districtImage("commercial-hub.png") },
  { id: "harbor", name: "Harbor", image: districtImage("harbor.png") },
  { id: "theater-square", name: "Theater Square", image: districtImage("theater-square.png") },
  { id: "industrial-zone", name: "Industrial Zone", image: districtImage("industrial-zone.png") },
  { id: "encampment", name: "Encampment", image: districtImage("encampment.png") },
  { id: "aerodrome", name: "Aerodrome", image: districtImage("aerodrome.png") },
  {
    id: "entertainment-complex",
    name: "Entertainment Complex",
    image: districtImage("entertainment-complex.png"),
  },
  { id: "water-park", name: "Water Park", image: districtImage("water-park.png") },
  {
    id: "diplomatic-quarter",
    name: "Diplomatic Quarter",
    image: districtImage("diplomatic-quarter.png"),
    singleBuild: true,
    reducedDiscountRate: true,
  },
  {
    id: "government-plaza",
    name: "Government Plaza",
    image: districtImage("government-plaza.png"),
    singleBuild: true,
    reducedDiscountRate: true,
  },
];
