export type CreatedCar = {
  id: string;
  vin: string;
  year: number;
  modelId: string;
  locationId: string | null;
  owner: string;
  ownerId: string | null;
  models: {
    name: string;
    brands: { name: string };
  };
  locations: {
    name: string;
    countries: { name: string };
  };
};
