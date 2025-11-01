import { TextInput } from "@mantine/core";

type Step2Props = {
  licensePlate: string;
  onChange: (nextPlate: string) => void;
  isValidPlate: (plate: string) => boolean;
};

export default function Step2({
  licensePlate,
  onChange,
  isValidPlate,
}: Step2Props) {
  const invalid =
    licensePlate && !isValidPlate(licensePlate)
      ? "Invalid EU plate format"
      : undefined;

  return (
    <div>
      <p className="font-bold text-lg mb-2">Enter your license plate number</p>

      <TextInput
        // autoFocus
        label="License Plate"
        placeholder="e.g. AB-123-CD or 1234 ABC"
        value={licensePlate}
        radius={0}
        onChange={(e) => {
          onChange(e.currentTarget.value.toUpperCase());
        }}
        error={invalid}
        classNames={{
          input:
            "placeholder:text-gray-400 placeholder:text-base focus:border-gray-600",
        }}
        styles={{
          input: { textAlign: "center", fontSize: "18px" },
        }}
      />

      <p className="text-sm text-gray-500 mt-2">
        The license number will be used for moderation and cannot be changed
        after publication.
      </p>
    </div>
  );
}
