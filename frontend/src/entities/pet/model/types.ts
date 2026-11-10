export type OrbiFinish =
  | "prism"
  | "glass"
  | "quilt"
  | "sun"
  | "tide"
  | "pearl"
  | "night"
  | "circuit"
  | "ceramic"
  | "cosmos"
  | "cloud"
  | "clay"
  | "ribbon"
  | "alloy"
  | "botanical";

export type OrbiDesign = {
  finish: OrbiFinish;
  shell: "visor" | "round" | "capsule" | "octagon" | "square" | "droplet";
  gear: "none" | "antenna" | "orbit" | "horns" | "flower";
  trim: "band" | "belt" | "stripe" | "panels" | "cheeks";
  pupil: "bar" | "round" | "diamond";
  look: -1 | 0 | 1;
  satellites: 2 | 3 | 4;
};

type PetBase = {
  id: string;
  name: string;
  kind: string;
  description: string;
  personality: string;
  greeting: string;
  color: string;
  bg: string;
  palette: string[];
};

export type Pet = PetBase &
  (
    | { category: "animals" | "unusual" | "mascots"; orbiDesign?: never }
    | { category: "orbi"; orbiDesign: OrbiDesign }
  );
