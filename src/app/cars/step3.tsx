import { decodeVinAndFillForm } from "@/services/vin.service";
import { NumberInput, Select, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { fuelTypes, driveTypes, transmissions } from "@/constants/carOptions";
import { fetchBrands, fetchModelsByBrand } from "@/services/car.service";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Brand } from "@/types/brand";
import type { Model } from "@/types/model";

export default function Step3({ form, handleChange }: any) {
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinLoading, setVinLoading] = useState(false);
  const [showManualFields, setShowManualFields] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  const [lastDecodedVin, setLastDecodedVin] = useState<string | null>(null);

  const resetDecodedVinFields = () => {
    handleChange("brand", "");
    handleChange("model", "");
    handleChange("brandId", "");
    handleChange("modelId", "");
    handleChange("year", "");
    handleChange("fuelType", "");
    handleChange("transmission", "");
    handleChange("engine", "");
    handleChange("driveType", "");
    handleChange("doors", "");
    handleChange("seats", "");

    setShowManualFields(false);
    setVinError(null);
    setLastDecodedVin(null);
  };

  useEffect(() => {
    const brand = brands.find((b) => b.id === form.brandId);
    if (brand) handleChange("brand", brand.name);
  }, [form.brandId]);

  useEffect(() => {
    const model = models.find((m) => m.id === form.modelId);
    if (model) handleChange("model", model.name);
  }, [form.modelId]);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  useEffect(() => {
    if (form.brandId) {
      fetchModelsByBrand(form.brandId).then(setModels);
    } else {
      setModels([]);
    }
  }, [form.brandId]);

  useEffect(() => {
    const vin = form.vin.trim().toUpperCase();

    if (lastDecodedVin && vin !== lastDecodedVin) {
      resetDecodedVinFields();
    }
  }, [form.vin]);

  const handleDecodeVin = async () => {
    setVinError(null);
    setVinLoading(true);
    try {
      const vin = form.vin.trim();
      if (!vin || vin.length < 11) {
        setVinError("Please enter the correct VIN.");
        return;
      }
      // ✅ Проверка VIN в Supabase
      const { data: existingCar } = await supabase
        .from("cars")
        .select("id")
        .eq("vin", vin)
        .maybeSingle();

      if (existingCar) {
        toast.error("A car with this VIN has already been added.");
        return;
      }
      const result = await decodeVinAndFillForm(form.vin);
      if (!result) {
        setVinError("Error decoding VIN.");
        setShowManualFields(true);
        return;
      }

      if (!result.brandMatched || !result.modelMatched) {
        setShowManualFields(true);
      } else {
        setShowManualFields(false);
      }

      handleChange("brand", result.brand);
      handleChange("model", result.model);
      handleChange("brandId", result.brandId || "");
      handleChange("modelId", result.modelId || "");
      handleChange("year", result.year || "");
      handleChange("fuelType", result.fuelType || "");
      handleChange("transmission", result.transmission || "");
      handleChange("engine", result.engine || "");
      handleChange("driveType", result.driveType || "");
      handleChange("doors", result.doors || "");
      handleChange("seats", result.seats || "");

      setShowManualFields(!result.brandMatched || !result.modelMatched);
      setLastDecodedVin(vin);
    } catch (err) {
      setVinError("Error while receiving data.");
      setShowManualFields(true);
    } finally {
      setVinLoading(false);
    }
  };

  const fuelOptions = fuelTypes.includes(form.fuelType)
    ? fuelTypes
    : form.fuelType
    ? [form.fuelType, ...fuelTypes]
    : fuelTypes;

  const driveOptions = driveTypes.includes(form.driveType)
    ? driveTypes
    : form.driveType
    ? [form.driveType, ...driveTypes]
    : driveTypes;

  // console.log(driveOptions);

  const transmissionOptions = transmissions.includes(form.transmission)
    ? transmissions
    : form.transmission
    ? [form.transmission, ...transmissions]
    : transmissions;

  return (
    <div className="space-y-4">
      <p className="font-bold text-lg">Tell us about your car</p>
      <TextInput
        label="What's your car’s VIN number?"
        placeholder="Write your VIN"
        radius={0}
        value={form.vin}
        onChange={(e) => {
          handleChange("vin", e.currentTarget.value.toUpperCase());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleDecodeVin();
        }}
        // className=" font-semibold"
        classNames={{
          input:
            "placeholder:text-gray-400 placeholder:font-normal, placeholder:text-base focus:border-gray-600",
        }}
        styles={{
          input: { textAlign: "center", fontSize: "18px" },
        }}
      />

      <button
        onClick={handleDecodeVin}
        className=" border bg-fuchsia-600 text-white rounded px-2 py-2 text-sm"
        type="button"
        disabled={vinLoading || !form.vin}
      >
        {vinLoading ? "Loading.." : "Approve VIN"}
      </button>

      {vinError && <p className="text-red-500 text-sm">{vinError}</p>}

      {!showManualFields && form.brandId && (
        <div className="bg-gray-50 border p-4 rounded space-y-2 text-sm text-gray-700">
          <p>
            <span className="font-semibold">Mark:</span> {form.brand}
          </p>
          <p>
            <span className="font-semibold">Model:</span> {form.model}
          </p>
          <p>
            <span className="font-semibold">Year:</span> {form.year}
          </p>
          <p>
            <span className="font-semibold">Fuel:</span> {form.fuelType || "—"}
          </p>
          <p>
            <span className="font-semibold">Transmission:</span>{" "}
            {form.transmission || "—"}
          </p>
          <p>
            <span className="font-semibold">Engine:</span> {form.engine || "—"}
          </p>
          <p>
            <span className="font-semibold">Drive Type:</span>{" "}
            {form.driveType || "—"}
          </p>
          <p>
            <span className="font-semibold">Doors:</span> {form.doors || "—"}
          </p>
          <p>
            <span className="font-semibold">Seats:</span> {form.seats || "—"}
          </p>

          <button
            onClick={() => setShowManualFields(true)}
            className="text-sm text-fuchsia-600 underline underline-offset-2  mt-2"
          >
            Edit manually
          </button>
        </div>
      )}

      {showManualFields && (
        <>
          <Select
            label="Mark"
            placeholder="Select mark"
            value={form.brandId || null}
            onChange={(value) => {
              const brandId = value ?? "";
              handleChange("brandId", brandId);

              // найти объект бренда и сохранить читаемое имя
              const brandObj = brands.find((b: any) => b.id === brandId);
              handleChange("brand", brandObj ? brandObj.name : "");

              // сбрасываем модель, потому что марка поменялась
              handleChange("modelId", "");
              handleChange("model", "");
            }}
            data={brands.map((b: any) => ({
              value: b.id,
              label: b.name,
            }))}
            maxDropdownHeight={200}
            searchable
            nothingFoundMessage="Not found"
          />

          <Select
            label="Model"
            placeholder="Select model"
            value={form.modelId || null}
            onChange={(value) => {
              const mid = value ?? "";
              handleChange("modelId", mid);

              const modelObj = models.find((m: any) => m.id === mid);
              handleChange("model", modelObj ? modelObj.name : "");
            }}
            data={models.map((m: any) => ({
              value: m.id,
              label: m.name,
            }))}
            maxDropdownHeight={200}
            searchable
            nothingFoundMessage="Not found"
            disabled={!form.brandId}
          />

          <NumberInput
            label="Year"
            value={form.year}
            onChange={(v) => handleChange("year", v === null ? "" : String(v))}
          />

          <Select
            label="Fuel type"
            placeholder="Select fuel type"
            value={form.fuelType || null}
            onChange={(value) => handleChange("fuelType", value ?? "")}
            data={fuelOptions.map((f) => ({
              value: f,
              label: f,
            }))}
            maxDropdownHeight={200}
          />

          <Select
            label="Transmission"
            placeholder="Select transmission"
            value={form.transmission || null}
            onChange={(value) => handleChange("transmission", value ?? "")}
            data={transmissionOptions.map((t) => ({
              value: t,
              label: t,
            }))}
            maxDropdownHeight={200}
          />

          <NumberInput
            label="Engine capacity"
            value={form.engine}
            onChange={(v) =>
              handleChange("engine", typeof v === "number" ? v : Number(v ?? 0))
            }
            step={0.1}
            decimalScale={1}
            fixedDecimalScale
            defaultValue={1.0}
            min={1}
            max={6}
          />

          <Select
            label="Drive type"
            placeholder="Select drive type"
            value={form.driveType || null}
            onChange={(value) => handleChange("driveType", value ?? "")}
            data={driveOptions.map((d) => ({
              value: d,
              label: d,
            }))}
            maxDropdownHeight={200}
          />

          <NumberInput
            label="Doors"
            value={form.doors}
            onChange={(v) => handleChange("doors", v === null ? "" : String(v))}
            defaultValue={2}
            min={2}
            max={5}
          />

          <NumberInput
            label="Seats"
            value={form.seats}
            onChange={(v) => handleChange("seats", v === null ? "" : String(v))}
            defaultValue={2}
            min={2}
            max={9}
          />
        </>
      )}
    </div>
  );
}
