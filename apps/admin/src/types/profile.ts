export type Profile = {
  id: string;
  auth_user_id: string | null;

  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;

  age: number | null;

  status: "pending" | "active" | "blocked" | string | null;

  // driver-related fields (как в БД)
  driver_dob: string | null; // ISO string
  driver_license_issue: string | null;
  driver_license_expiry: string | null;
  driver_license_number: string | null;
  driver_license_file_url: string | null;

  created_at: string | null;
  is_host: boolean | null;
};
