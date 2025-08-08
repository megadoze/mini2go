import { decodeVinAndFillForm } from "@/services/vin.service";
import { NativeSelect, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { fuelTypes, transmissions } from "@/constants/carOptions";
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
        setVinError("Введите корректный VIN");
        return;
      }
      // ✅ Проверка VIN в Supabase
      const { data: existingCar } = await supabase
        .from("cars")
        .select("id")
        .eq("vin", vin)
        .maybeSingle();

      if (existingCar) {
        toast.error("Авто с таким VIN уже добавлено");
        return;
      }
      const result = await decodeVinAndFillForm(form.vin);
      if (!result) {
        setVinError("Ошибка при декодировании VIN");
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

      setShowManualFields(!result.brandMatched || !result.modelMatched);
      setLastDecodedVin(vin);
    } catch (err) {
      setVinError("Ошибка при получении данных");
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
          <NativeSelect
            label="Бренд"
            value={form.brandId}
            onChange={(e) => handleChange("brandId", e.currentTarget.value)}
            data={[
              { value: "", label: "Выбери бренд" },
              ...brands.map((b: any) => ({
                value: b.id,
                label: b.name,
              })),
            ]}
          />

          <NativeSelect
            label="Модель"
            value={form.modelId}
            onChange={(e) => handleChange("modelId", e.currentTarget.value)}
            data={[
              { value: "", label: "Выбери модель" },
              ...models.map((m: any) => ({
                value: m.id,
                label: m.name,
              })),
            ]}
            disabled={!form.brandId}
          />

          <TextInput
            label="Год выпуска"
            type="number"
            value={form.year}
            onChange={(e) => handleChange("year", e.currentTarget.value)}
          />

          <NativeSelect
            label="Тип топлива"
            value={form.fuelType}
            onChange={(e) => handleChange("fuelType", e.currentTarget.value)}
            data={[
              { value: "", label: "Выбери тип топлива" },
              ...fuelOptions.map((f) => ({ value: f, label: f })),
            ]}
          />

          <NativeSelect
            label="Коробка передач"
            value={form.transmission}
            onChange={(e) =>
              handleChange("transmission", e.currentTarget.value)
            }
            data={[
              { value: "", label: "Выбери коробку" },
              ...transmissionOptions.map((t) => ({ value: t, label: t })),
            ]}
          />
        </>
      )}
    </div>
  );
}
