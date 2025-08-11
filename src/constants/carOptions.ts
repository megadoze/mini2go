export const fuelTypes = ["Gasoline", "Diesel", "Electro", "Hybrid"] as const;
export const transmissions = ["Manual", "Automatic"] as const;
export const driveTypes = ["Front", "Rear", "Full"] as const;
export const bodyTypes = [
  "Sedan",
  "Hatchback",
  "Station wagon",
  "Crossover",
  "SUV",
  "Coupe",
  "Convertible",
  "Minivan",
  "Pickup",
] as const;
export const statuses = ["available", "busy", "repair"] as const;
export const colors = [
  "White",
  "Black",
  "Gray",
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
] as const;
export const doorOptions = [2, 3, 4, 5] as const;
export const seatOptions = [2, 4, 5, 6, 7, 8] as const;

export const optionsDeliveryFee = [
  "0",
  "5",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "50",
];

export const optionsDistance = [
  "100",
  "200",
  "250",
  "300",
  "350",
  "400",
  "450",
  "500",
];

export const optionsExtraPrices = [
  "0",
  "5",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
];

export const optionsOwnerCar = [
  {
    name: "me",
    label: "I own the car",
    description: "The car is registered for private use",
    value: "me",
  },
  {
    name: "leasing",
    label: "I lease the car",
    description: "The car is leased for private use",
    value: "leasing",
  },
  {
    name: "business",
    label: "Business",
    description: "I will rent out as a registered business",
    value: "business",
  },
];
