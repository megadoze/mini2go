export type RawCar = {
  id: string;
  vin: string;
  year: number | string | null;
  license_plate: string | null;
  model_id: string;
  status: string;
  location_id: string;
  lat?: number;
  long?: number;
  address?: string;
  pickup_info?: string;
  return_info?: string;
  is_delivery?: boolean;
  delivery_fee?: number;
  include_mileage?: number;
  price?: number;
  deposit?: number;
  photos?: string[];
  models: {
    name: string;
    brands: {
      name: string;
    }[];
  }[];
  locations: {
    name: string;
    countries: {
      id: string;
      name: string;
    }[];
  }[];
};
