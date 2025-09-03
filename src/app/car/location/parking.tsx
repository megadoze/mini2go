import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Map,
  Marker,
  FullscreenControl,
  ScaleControl,
  NavigationControl,
  useMap,
  GeolocateControl,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { AddressAutofill } from "@mapbox/search-js-react";
import Pin from "@/components/pin";
import { updateCar } from "@/services/car.service";
import { useCarContext } from "@/context/carContext";
import { toast } from "sonner";
import { fetchAddressFromCoords } from "../../../services/geo.service";

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

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function Parking() {
  const {
    car,
    parkingAddress,
    setParkingAddress,
    parkingCoords,
    setCoords,
    pickupInfo,
    setPickupInfo,
  } = useCarContext();

  const navigate = useNavigate();

  const carId = car.id;

  const [address, setAddress] = useState(parkingAddress || "");
  const [fullAddress, setFullAddress] = useState(parkingAddress || "");

  const defaultCoords = {
    latitude: 50.1109,
    longitude: 8.6821,
    zoom: 4.5,
    bearing: 0,
    pitch: 0,
  };

  const [coords, setLocalCoords] = useState(
    parkingCoords?.latitude && parkingCoords?.longitude
      ? {
          latitude: parkingCoords.latitude,
          longitude: parkingCoords.longitude,
          zoom: 10,
          bearing: 0,
          pitch: 0,
        }
      : defaultCoords
  );

  const [info, setInfo] = useState(
    pickupInfo || { pickupInfo: "", returnInfo: "" }
  );

  const [error, setError] = useState({ address: false });

  const [saved, setSaved] = useState(false);

  const isChanged = useMemo(() => {
    return (
      address !== parkingAddress ||
      coords.longitude !== parkingCoords?.longitude ||
      coords.latitude !== parkingCoords?.latitude ||
      info.pickupInfo !== pickupInfo?.pickupInfo ||
      info.returnInfo !== pickupInfo?.returnInfo
    );
  }, [address, coords, info, parkingAddress, parkingCoords, pickupInfo]);

  useEffect(() => {
    const updateAddress = async () => {
      try {
        const data = await fetchAddressFromCoords(
          coords.latitude,
          coords.longitude
        );
        if (data) {
          setFullAddress(data.address);
          setAddress(data.address);
        }
      } catch (err) {
        console.error("Failed to fetch address", err);
      }
    };

    updateAddress();
  }, [coords.latitude, coords.longitude]);

  useEffect(() => {
    if (address) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        const newCoords = {
          latitude,
          longitude,
          zoom: 14,
          bearing: 0,
          pitch: 0,
        };

        try {
          const data = await fetchAddressFromCoords(latitude, longitude);
          if (data) {
            setFullAddress(data.address);
            setAddress(data.address);
            setLocalCoords(newCoords);
          }
        } catch (err) {
          console.error("Failed to fetch address by current location", err);
        }
      },
      (err) => {
        console.error("Geolocation error", err);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Выбираем адрес из списка
  const handleCoordinates = async (data: {
    features: MapboxFeature[];
    query: string;
  }) => {
    const feature =
      data.features?.find((f) => f.place_type?.includes("address")) ||
      data.features?.find((f) => f.place_type?.includes("place")) ||
      data.features?.[0];

    if (!feature?.geometry?.coordinates) return;

    const [longitude, latitude] = feature.geometry.coordinates;
    console.log(longitude, latitude);

    // const full_address = data.features[0].properties.full_address;
    const full_address =
      feature?.properties?.full_address || feature?.place_name || data.query;

    const newCoords = {
      latitude,
      longitude,
      zoom: 14,
      bearing: 0,
      pitch: 0,
    };

    setLocalCoords(newCoords);
    setFullAddress(full_address);
    setAddress(full_address);
  };

  // Меняем адрес вручную
  // const handleChangeAddress = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setAddress(value);
  // };

  const handleChangeInfo = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInfo((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  // Созраняем в базе
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError({ address: true });
      return;
    }

    try {
      if (!carId) return null;

      await updateCar(carId, {
        address: fullAddress,
        lat: coords.latitude,
        long: coords.longitude,
        pickupInfo: info.pickupInfo,
        returnInfo: info.returnInfo,
      });

      setCoords({ latitude: coords.latitude, longitude: coords.longitude });
      setParkingAddress(fullAddress);
      setPickupInfo(info);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Location saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while saving!");
    }
  };

  function Navigation() {
    const { current: map } = useMap();
    useEffect(() => {
      if (map && coords) {
        map.flyTo({
          center: [coords.longitude, coords.latitude],
          zoom: 13,
          speed: 1.2,
        });
      }
    }, [map, coords]);
    return null;
  }

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h2 className="font-roboto text-xl md:text-2xl font-medium">
        Location & delivery
      </h2>
      <div className="border-b border-gray-100 mt-5 shadow-sm" />

      <div className="mt-5">
        <p className="text-lg font-medium text-gray-800">Location</p>
        <p className="mt-2 text-gray-600">
          Where your car is normally parked. This will only be shown once a
          booking is confirmed.
        </p>

        <div className="mt-5">
          <Map
            initialViewState={coords}
            style={{ width: "100%", height: "250px", borderRadius: "10px" }}
            mapStyle="mapbox://styles/megadoze/cldamjew5003701p5mbqrrwkc"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            <Navigation />
            <Marker
              longitude={coords.longitude}
              latitude={coords.latitude}
              draggable
              onDragEnd={async (e) => {
                const lngLat = e.lngLat;
                const newCoords = {
                  latitude: lngLat.lat,
                  longitude: lngLat.lng,
                  zoom: coords.zoom,
                  bearing: coords.bearing,
                  pitch: coords.pitch,
                };

                setLocalCoords(newCoords);

                try {
                  const data = await fetchAddressFromCoords(
                    lngLat.lat,
                    lngLat.lng
                  );
                  if (data) {
                    setAddress(data.address);
                    setFullAddress(data.address);
                    setParkingAddress(data.address); // ← ключевая строка
                  }
                } catch (err) {
                  console.error("Failed to fetch address by pin drag", err);
                }
              }}
            >
              <Pin />
            </Marker>
            <GeolocateControl
              trackUserLocation
              showUserHeading
              onGeolocate={async (pos) => {
                const { latitude, longitude } = pos.coords;
                const newCoords = {
                  latitude,
                  longitude,
                  zoom: 14,
                  bearing: 0,
                  pitch: 0,
                };
                setLocalCoords(newCoords);
                try {
                  const data = await fetchAddressFromCoords(
                    latitude,
                    longitude
                  );
                  if (data) {
                    setAddress(data.address);
                    setFullAddress(data.address);
                    setParkingAddress(data.address); // ← ключевая строка
                  }
                } catch (err) {
                  console.error("Failed to fetch address by pin drag", err);
                }
              }}
            />

            <NavigationControl />
            <ScaleControl />
            <FullscreenControl />
          </Map>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <AddressAutofillWrapper
            accessToken={MAPBOX_TOKEN}
            onRetrieve={handleCoordinates}
            browserAutofillEnabled={false}
          >
            <input
              name="address"
              id="address"
              placeholder="Address"
              type="text"
              autoComplete="address-line1"
              value={parkingAddress}
              onChange={(e) => setParkingAddress(e.target.value)}
              className="outline-none pl-2 py-2 w-full border border-gray-300 hover:border-gray-400 focus:border-green-300"
            />
          </AddressAutofillWrapper>
          {error.address && (
            <p className="text-xs text-red-600 mt-1">Field is required</p>
          )}

          <div className="mt-10">
            <p className="text-lg font-medium text-gray-800">
              Pick-up information
            </p>
            <textarea
              id="pickupInfo"
              maxLength={500}
              rows={5}
              className="py-1 w-full border border-gray-300 hover:border-gray-400 focus:border-green-300 outline-none pl-2 mt-2"
              value={info.pickupInfo ?? ""}
              onChange={handleChangeInfo}
              placeholder="Pick-up information"
            />
          </div>

          <div className="mt-8">
            <p className="text-lg font-medium text-gray-800">
              Return information
            </p>
            <textarea
              id="returnInfo"
              maxLength={500}
              rows={5}
              className="py-1 w-full border border-gray-300 hover:border-gray-400 focus:border-green-300 outline-none pl-2 mt-2"
              value={info.returnInfo ?? ""}
              onChange={handleChangeInfo}
              placeholder="Return information"
            />
          </div>

          <div className="flex justify-between items-centermt-8 text-right mt-10">
            <button
              type="button"
              className={`border-gray-300 border rounded-md px-6 py-2 mr-2`}
              onClick={() => navigate(-1)}
            >
              Back
            </button>
            <div>
              {saved && (
                <span className="text-green-500 font-medium text-sm animate-fade-in mr-2">
                  ✓ Saved
                </span>
              )}
              <button
                className={`${
                  isChanged
                    ? "border-gray-600 text-gray-700"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"
                } border rounded-md px-8 py-2`}
                disabled={!isChanged}
                onClick={handleSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Parking;
