export type Extra = {
  id: string;
  name: string;
  description: string;
  price_type: "per_day" | "per_rental" | "per_unit";
  is_active: boolean;
};
