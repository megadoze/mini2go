const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export async function fetchAddressFromCoords(lat: number, lon: number) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}`
  );
  const data = await response.json();

  const feature =
    data.features?.find((f: any) => f.place_type?.includes("address")) ||
    data.features?.find((f: any) => f.place_type?.includes("place")) ||
    data.features?.[0];

  return feature?.place_name || "";
}
