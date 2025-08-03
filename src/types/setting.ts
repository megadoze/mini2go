export type AppSettings = {
  id: string;
  currency: string;
  scope: string; // 'global'
  openTime: number;
  closeTime: number;
  minRentPeriod: number;
  maxRentPeriod: number;
  intervalBetweenBookings: number;
  ageRenters: number;
  minDriverLicense: number;
  isInstantBooking: boolean;
  isSmoking: boolean;
  isPets: boolean;
  isAbroad: boolean;
  updatedAt: string;
};
