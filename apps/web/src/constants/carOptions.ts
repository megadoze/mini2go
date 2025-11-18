export const fuelTypes = ["Gasoline", "Diesel", "Electro", "Hybrid"] as const;

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
    price: "from €59/day",
    img: "/img/one.png",
    href: "/cars?model=cooper-3d",
  },
  {
    title: "Cabrio",
    subtitle: "Silent & zippy",
    price: "from €69/day",
    img: "/img/cabrio.png",
    href: "/cars?model=electric",
  },
  {
    title: "Aceman",
    subtitle: "Электрический пиздец",
    price: "from €88/day",
    img: "/img/aceman3.png",
    href: "/cars?model=aceman",
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
    poster: "/img/minicabrioposter2.webp",
  },
  {
    title: "MINI Cooper Aceman",
    description: "The feeling of a go-kart with an open roof, 2+2 seats",
    fuel: "Electro",
    src: "/videos/mini-aceman.mp4",
    poster: "/img/aceman2.webp",
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
