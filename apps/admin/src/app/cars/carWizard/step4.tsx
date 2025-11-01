import {
  Map,
  Marker,
  FullscreenControl,
  ScaleControl,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import { AddressAutofill } from "@mapbox/search-js-react";
import Pin from "@/components/pin";
import React from "react";

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

type Step4Props = {
  lat: number | null;
  long: number | null;
  address: string;
  countryName: string;
  cityName: string;
  onChangeField: (
    field: "lat" | "long" | "address" | "countryName" | "cityName",
    value: any
  ) => void;
  fetchAddressFromCoords: (
    lat: number,
    long: number
  ) => Promise<{
    address: string;
    country: string;
    city: string;
  } | null>;
  mapboxToken: string;
};

export default function Step4({
  lat,
  long,
  address,
  countryName,
  cityName,
  onChangeField,
  fetchAddressFromCoords,
  mapboxToken,
}: Step4Props) {
  const fallbackLat = lat ?? 50.45;
  const fallbackLong = long ?? 30.52;

  async function applyCoordsAndReverseGeocode(
    nextLat: number,
    nextLong: number
  ) {
    onChangeField("lat", nextLat);
    onChangeField("long", nextLong);

    const addr = await fetchAddressFromCoords(nextLat, nextLong);
    if (!addr) return;

    onChangeField("address", addr.address);
    onChangeField("countryName", addr.country);
    onChangeField("cityName", addr.city);
  }

  return (
    <div className="space-y-4">
      <p className="font-bold text-lg">Where is your car normally parked?</p>

      <div className="h-60 rounded-xl overflow-hidden">
        <Map
          initialViewState={{
            latitude: fallbackLat,
            longitude: fallbackLong,
            zoom: 12,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
          mapboxAccessToken={mapboxToken}
        >
          <Marker
            longitude={fallbackLong}
            latitude={fallbackLat}
            draggable
            onDragEnd={async (e) => {
              const { lat: newLat, lng: newLong } = e.lngLat;
              await applyCoordsAndReverseGeocode(newLat, newLong);
            }}
          >
            <Pin />
          </Marker>

          <GeolocateControl
            trackUserLocation
            showUserHeading
            onGeolocate={async (pos) => {
              const newLat = pos.coords.latitude;
              const newLong = pos.coords.longitude;
              await applyCoordsAndReverseGeocode(newLat, newLong);
            }}
          />

          <NavigationControl />
          <ScaleControl />
          <FullscreenControl />
        </Map>
      </div>

      <AddressAutofillWrapper
        accessToken={mapboxToken}
        onRetrieve={async (res) => {
          const f = res.features?.[0];
          if (!f?.geometry?.coordinates) return;

          const [lngFromSearch, latFromSearch] = f.geometry.coordinates;
          await applyCoordsAndReverseGeocode(latFromSearch, lngFromSearch);
        }}
      >
        <input
          name="address"
          id="address"
          type="text"
          value={address || ""}
          onChange={(e) => onChangeField("address", e.target.value)}
          placeholder="Введите адрес"
          autoComplete="address-line1"
          className=" w-full p-2 mt-2 outline-none border border-gray-300 focus:border-gray-600"
        />
      </AddressAutofillWrapper>

      <div className="text-sm text-gray-600 space-y-1">
        <p>
          Country: <span className="font-semibold">{countryName || "—"}</span>
        </p>
        <p>
          City: <span className="font-semibold">{cityName || "—"}</span>
        </p>
      </div>
    </div>
  );
}
