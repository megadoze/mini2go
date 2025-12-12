export type SeoCarRow = {
  created_at: string | null | undefined;
  car_id: string;
  vin: string | null;
  year: number | null;
  license_plate: string | null;
  status: string | null;
  owner_id: string | null;
  price: number | null;
  currency: string | null;

  brand_name: string;
  model_name: string;

  location_name: string | null;
  country_id: string | null;
  country_name: string | null;

  seo_exists: boolean;
  seo_is_custom: boolean | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_updated_at?: string | null;
};
