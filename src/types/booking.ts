export type Booking = {
  id: string;
  carId: string;
  userId: string;
  startDate: string;
  endDate: string;
  startTime: { value: number; label: string };
  endTime: { value: number; label: string };
  mark: "booking" | "block";
  status: { value: string; label: string; isActive: boolean };
  createdAt?: string;
};
