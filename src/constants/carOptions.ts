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

export const NAV = [
  { label: "Cars", href: "cars" },
  { label: "Special", href: "#special" },
  { label: "Terms", href: "#terms" },
  { label: "FAQ", href: "#faq" },
  { label: "Contacts", href: "#contacts" },
];

export const CAR_CARDS = [
  {
    title: "Cooper",
    subtitle: "Urban go-kart feel",
    price: "from €89/day",
    img: "/img/one.png",
    href: "/cars?model=cooper-3d",
  },
  {
    title: "Cabrio",
    subtitle: "Silent & zippy",
    price: "from €99/day",
    img: "/img/cabrio.png",
    href: "/cars?model=electric",
  },
  {
    title: "Countryman",
    subtitle: "Space for adventures",
    price: "from €109/day",
    img: "/img/countryman.png",
    href: "/cars?model=countryman",
  },
];

export const VIDEO_TEASERS = [
  {
    title: "Cooper city ride",
    src: "/videos/mini-one.mp4",
    poster: "/img/minione.webp",
  },
  {
    title: "Countryman escape",
    src: "/videos/mini-U25.mp4",
    poster: "/img/minicountryman.webp",
  },
  {
    title: "Cabrio seaside",
    src: "/videos/mini-cabrio.mp4",
    poster: "/img/minicabrio.webp",
  },
] as const;
