export function toCamelCar(raw: any) {
  const model = Array.isArray(raw.model) ? raw.model[0] : raw.model;
  const brands = model
    ? Array.isArray(model.brands)
      ? model.brands[0]
      : model.brands
    : null;
  const location = Array.isArray(raw.location) ? raw.location[0] : raw.location;

  return {
    id: raw.id,
    vin: raw.vin ?? null,
    year: raw.year != null ? Number(raw.year) : null,
    licensePlate: raw.license_plate ?? raw.licensePlate ?? null,
    fuelType: raw.fuel_type ?? raw.fuelType ?? null,
    transmission: raw.transmission ?? null,
    seats: raw.seats != null ? Number(raw.seats) : null,
    engineCapacity: raw.engine_capacity ?? raw.engineCapacity ?? null,
    bodyType: raw.body_type ?? raw.bodyType ?? null,
    driveType: raw.drive_type ?? raw.driveType ?? null,
    color: raw.color ?? null,
    doors: raw.doors != null ? Number(raw.doors) : null,

    model: model
      ? { id: model.id, name: model.name, brand_id: model.brand_id, brands }
      : null,
    location: location ?? null,

    address: raw.address ?? "",
    lat: raw.lat ?? raw.latitude ?? null,
    long: raw.long ?? raw.longitude ?? null,
    pickupInfo: raw.pickupInfo ?? raw.pickup_info ?? "",
    returnInfo: raw.returnInfo ?? raw.return_info ?? "",

    isDelivery: raw.isDelivery ?? raw.is_delivery ?? false,
    deliveryFee: raw.deliveryFee ?? raw.delivery_fee ?? 0,
    includeMileage: raw.includeMileage ?? raw.include_mileage ?? 0,

    price: raw.price ?? null,
    deposit: raw.deposit ?? null,

    currency: raw.currency ?? null,
    openTime: raw.open_time ?? raw.openTime ?? undefined,
    closeTime: raw.close_time ?? raw.closeTime ?? undefined,
    minRentPeriod: raw.min_rent_period ?? raw.minRentPeriod ?? undefined,
    maxRentPeriod: raw.max_rent_period ?? raw.maxRentPeriod ?? undefined,
    intervalBetweenBookings:
      raw.interval_between_bookings ?? raw.intervalBetweenBookings ?? undefined,
    ageRenters: raw.age_renters ?? raw.ageRenters ?? undefined,
    minDriverLicense:
      raw.min_driver_license ?? raw.minDriverLicense ?? undefined,
    isInstantBooking:
      raw.is_instant_booking ?? raw.isInstantBooking ?? undefined,
    isSmoking: raw.is_smoking ?? raw.isSmoking ?? undefined,
    isPets: raw.is_pets ?? raw.isPets ?? undefined,
    isAbroad: raw.is_abroad ?? raw.isAbroad ?? undefined,

    photos: raw.photos ?? [],
    content: raw.content ?? "",
    status: raw.status ?? "",
    owner: raw.owner ?? "",
    ownerId: raw.owner_id ?? null,
  };
}
