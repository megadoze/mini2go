import { Select } from "@mantine/core";
import {
  Map,
  Marker,
  FullscreenControl,
  ScaleControl,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import type { MapRef, ViewState } from "react-map-gl/mapbox";
import { AddressAutofill } from "@mapbox/search-js-react";
import Pin from "@/components/pin";
import { fetchAddressFromCoords } from "@/services/geo.service";

type DeliveryOption = "car_address" | "by_address";

type MapboxFeature = {
  place_type?: string[];
  place_name?: string;
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    [key: string]: any;
    full_address?: string;
  };
};

type AddressAutofillWrapperProps = {
  accessToken: string;
  onRetrieve?: (event: { features: MapboxFeature[]; query: string }) => void;
  browserAutofillEnabled?: boolean;
  children?: React.ReactNode;
};

const AddressAutofillWrapper =
  AddressAutofill as React.FC<AddressAutofillWrapperProps>;

type BookingDeliveryCardProps = {
  delivery: DeliveryOption;
  setDelivery: (v: DeliveryOption) => void;
  deliveryOptions: { value: string; label: string }[];
  isLocked: boolean;

  deliveryFee: number;
  effectiveCurrency: string;

  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;

  deliveryLat: number | null;
  setDeliveryLat: (v: number | null) => void;

  deliveryLong: number | null;
  setDeliveryLong: (v: number | null) => void;

  deliveryCountry: string;
  setDeliveryCountry: (v: string) => void;

  deliveryCity: string;
  setDeliveryCity: (v: string) => void;

  mapView: ViewState;
  setMapView: React.Dispatch<React.SetStateAction<ViewState>>;
  mapRef: React.RefObject<MapRef | null>;

  car: any;
  deliveryFeeValue: number;
  setDeliveryFeeValue: (v: number) => void;
};

export const BookingDeliveryCard: React.FC<BookingDeliveryCardProps> = ({
  delivery,
  setDelivery,
  deliveryOptions,
  isLocked,
  deliveryFee,
  effectiveCurrency,
  deliveryAddress,
  setDeliveryAddress,
  deliveryLat,
  setDeliveryLat,
  deliveryLong,
  setDeliveryLong,
  deliveryCountry,
  setDeliveryCountry,
  deliveryCity,
  setDeliveryCity,
  mapView,
  setMapView,
  mapRef,
  car,
  deliveryFeeValue,
  setDeliveryFeeValue,
}) => {
  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Delivery</h2>
          <p className="mt-1 text-xs text-gray-500">
            Pickup or drop-off location
          </p>
        </div>
      </div>

      {/* select + fee */}
      <div className="relative mt-4 space-y-2 z-0">
        <Select
          value={delivery}
          onChange={async (v: any) => {
            const next = (v ?? "car_address") as DeliveryOption;
            setDelivery(next);

            if (next === "car_address") {
              setDeliveryFeeValue(0);
              return;
            }

            // next === "by_address"
            if (!deliveryFeeValue && (car as any)?.deliveryFee != null) {
              setDeliveryFeeValue(Number((car as any).deliveryFee));
            }

            // автоподстановка адреса/координат если пусто
            if (!deliveryAddress && car?.lat != null && car?.long != null) {
              const lat = Number(car.lat);
              const lng = Number(car.long);
              setDeliveryLat(lat);
              setDeliveryLong(lng);

              try {
                const addr = await fetchAddressFromCoords(lat, lng);
                setDeliveryAddress(addr?.address || car?.address || "");
                setDeliveryCountry(addr?.country || "");
                setDeliveryCity(addr?.city || "");
              } catch {
                setDeliveryAddress(car?.address || "");
                setDeliveryCountry("");
                setDeliveryCity("");
              }

              // подвинуть карту
              setMapView((prev) => ({
                ...prev,
                latitude: lat,
                longitude: lng,
                zoom: 13,
              }));
              mapRef.current?.flyTo({
                center: [lng, lat],
                zoom: 13,
                essential: true,
              });
            }
          }}
          data={deliveryOptions}
          readOnly={isLocked}
          radius="md"
          className={isLocked ? "opacity-60" : ""}
          classNames={{
            input: isLocked ? "!cursor-not-allowed focus:border-gray-300" : "",
          }}
        />

        <div className="text-[11px] text-gray-600">
          Delivery fee:&nbsp;
          <b className="text-gray-800">
            {deliveryFee.toFixed(2)} {effectiveCurrency}
          </b>
        </div>
      </div>

      {/* map + address only if delivery by_address */}
      {delivery === "by_address" && (
        <div className={`mt-4 space-y-4 ${isLocked ? "opacity-60" : ""}`}>
          {/* MAP CARD */}
          <div className="relative z-0 h-60 overflow-hidden rounded-xl border border-gray-100 shadow-sm ring-1 ring-gray-100">
            <Map
              ref={mapRef}
              {...mapView}
              onMove={(e) => setMapView(e.viewState as ViewState)}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
              mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
              interactive={!isLocked}
            >
              <Marker
                longitude={deliveryLong ?? car?.long ?? 30.52}
                latitude={deliveryLat ?? car?.lat ?? 50.45}
                draggable={!isLocked}
                onDragEnd={async (e) => {
                  const { lat, lng } = e.lngLat;
                  setDeliveryLat(lat);
                  setDeliveryLong(lng);
                  setMapView((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                    zoom: Math.max(prev.zoom, 13),
                  }));

                  try {
                    const addr = await fetchAddressFromCoords(lat, lng);
                    if (addr) {
                      setDeliveryAddress(addr.address || "");
                      setDeliveryCountry(addr.country || "");
                      setDeliveryCity(addr.city || "");
                    }
                  } catch {}
                }}
              >
                <Pin />
              </Marker>

              <GeolocateControl
                trackUserLocation
                showUserHeading
                onGeolocate={async (pos) => {
                  if (isLocked) return;
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  setDeliveryLat(lat);
                  setDeliveryLong(lng);
                  setMapView((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                    zoom: Math.max(prev.zoom, 13),
                  }));
                  mapRef.current?.flyTo({
                    center: [lng, lat],
                    zoom: Math.max(mapView.zoom, 13),
                    essential: true,
                  });

                  try {
                    const addr = await fetchAddressFromCoords(lat, lng);
                    if (addr) {
                      setDeliveryAddress(addr.address || "");
                      setDeliveryCountry(addr.country || "");
                      setDeliveryCity(addr.city || "");
                    }
                  } catch {}
                }}
              />

              <NavigationControl />
              <ScaleControl />
              <FullscreenControl />
            </Map>
          </div>

          {/* ADDRESS INPUT + meta */}
          <div className="space-y-2">
            <AddressAutofillWrapper
              accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
              onRetrieve={async (res: any) => {
                if (isLocked) return;
                const f = res?.features?.[0];
                const coords = f?.geometry?.coordinates as
                  | [number, number]
                  | undefined;
                if (!coords) return;

                const [lng, lat] = coords;
                setDeliveryLat(lat);
                setDeliveryLong(lng);

                // показать адрес сразу
                const fallback =
                  f?.properties?.full_address || f?.place_name || "";
                try {
                  const addr = await fetchAddressFromCoords(lat, lng);
                  setDeliveryAddress(addr?.address || fallback);
                  setDeliveryCountry(addr?.country || "");
                  setDeliveryCity(addr?.city || "");
                } catch {
                  setDeliveryAddress(fallback);
                  setDeliveryCountry("");
                  setDeliveryCity("");
                }

                // сдвинуть карту
                setMapView((prev) => ({
                  ...prev,
                  latitude: lat,
                  longitude: lng,
                  zoom: Math.max(prev.zoom, 13),
                }));
                mapRef.current?.flyTo({
                  center: [lng, lat],
                  zoom: Math.max(mapView.zoom, 14),
                  essential: true,
                });
              }}
            >
              <input
                name="delivery-address"
                id="delivery-address"
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter delivery address"
                autoComplete="address-line1"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                disabled={isLocked}
              />
            </AddressAutofillWrapper>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
              <p>
                <span className="text-gray-500">Country: </span>
                <span className="font-semibold text-gray-800">
                  {deliveryCountry || "—"}
                </span>
              </p>
              <p>
                <span className="text-gray-500">City: </span>
                <span className="font-semibold text-gray-800">
                  {deliveryCity || "—"}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
