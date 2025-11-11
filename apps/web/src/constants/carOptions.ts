export const fuelTypes = ["Gasoline", "Diesel", "Electro", "Hybrid"] as const;
export const transmissions = ["Automatic", "Manual"] as const;
export const driveTypes = ["Front", "Rear", "Full"] as const;
export const bodyTypes = [
  "Sedan",
  "Hatchback",
  "Station wagon",
  "SUV",
  "Coupe",
  "Cabrio",
  "Minivan",
  "Pickup",
] as const;
// export const statuses = ["available", "unavailable"] as const;
export const statuses = ["available", "unavailable", "pending_review"] as const;

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
export const doorOptions = ["2", "3", "4", "5"] as const;
export const seatOptions = ["2", "4", "5", "6", "7", "8"] as const;

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
    title: "Cabrio",
    subtitle: "Silent & zippy",
    price: "from €99/day",
    img: "/img/cabrio.png",
    href: "/cars?model=electric",
  },
  {
    title: "Cooper",
    subtitle: "Urban go-kart feel",
    price: "from €89/day",
    img: "/img/one.png",
    href: "/cars?model=cooper-3d",
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
    title: "MINI Cooper",
    description: "Iconic 2-door car with a sporty character, 2+2 seats",
    fuel: "Gasoline",
    src: "/videos/mini-one.mp4",
    poster: "/img/minione.webp",
  },
  {
    title: "MINI Countryman",
    description: "Multifunctional compact SUV built for adventure, 5 seats",
    fuel: "Gasoline",
    src: "/videos/mini-U25.mp4",
    poster: "/img/minicountryman.webp",
  },
  {
    title: "MINI Cooper Cabrio",
    description: "The feeling of a go-kart with an open roof, 2+2 seats",
    fuel: "Gasoline",
    src: "/videos/mini-cabrio.mp4",
    poster: "/img/minicabrioposter.webp",
  },
  {
    title: "MINI Cooper Aceman",
    description: "The feeling of a go-kart with an open roof, 2+2 seats",
    fuel: "Gasoline",
    src: "/videos/mini-aceman.mp4",
    poster: "/img/aceman-poster.webp",
  },
] as const;

export const WELCOME_FEATURES = [
  {
    title: "Experience the fascination",
    text: "It's hard to describe what it's like to drive a MINI. You have to experience it yourself.",
    img: "/img/minicountrymancard.webp",
    alt: "MINI close-up",
  },
  {
    title: "Discover new heights",
    text: "From classics to current models — find the MINI that fits your style.",
    img: "/img/minionecard.webp",
    alt: "MINI in the city",
  },
  {
    title: "Just drive",
    text: "Insurance, second driver and generous mileage included. Less hassle, more joy.",
    img: "/img/minicabriocard.webp",
    alt: "MINI interior",
  },
];

export const MINI_WORLD_POSTS = [
  {
    tag: "News",
    title: "The updated MINI Cooper: even more fun in the city",
    excerpt:
      "Short wheelbase and go-kart handling — the recipe for pure joy. We break down the key updates.",
    img: VIDEO_TEASERS[0]?.poster,
    href: "#",
  },
  {
    tag: "Technology",
    title: "Electric MINI: what's inside?",
    excerpt:
      "Platform, charging, and real-world range — practical insights without the fluff.",
    img: VIDEO_TEASERS[2]?.poster,
    href: "#",
  },
  {
    tag: "Lifestyle",
    title: "MINI and weekend urban routes",
    excerpt: "Three compact itineraries where a MINI feels right at home.",
    img: VIDEO_TEASERS[1]?.poster,
    href: "#",
  },
];
