export type RawCar = {
  id: string;
  vin: string;
  year: number | string | null;
  license_plate: string | null;
  model_id: string;
  created_at: string;
  models: {
    name: string;
    brands: {
      name: string;
    }[];
  }[];
  location_id: string;
  locations: {
    name: string;
    countries: {
      name: string;
    }[];
  }[];
  photos?: string[];
  lat?: number;
  long?: number;
  address?: string;
  pickupInfo?: string;
  returnInfo?: string;
  isDelivery?: boolean;
  deliveryFee?: number;
  includeMileage?: number;
  price?: number;
  deposit?: number;
};
