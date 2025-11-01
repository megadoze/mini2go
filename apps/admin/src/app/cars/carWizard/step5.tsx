import { TextInput } from "@mantine/core";

type Step5Props = {
  price: string;
  onChangePrice: (value: string) => void;
};

export default function Step5({ price, onChangePrice }: Step5Props) {
  return (
    <div>
      <p className="font-bold text-lg mt-5">This will be your daily price</p>

      <p className=" text-gray-700 mt-4 mb-3">
        Our price suggestion is based on checking your specific car model
        against current market prices and demand.
      </p>

      <TextInput
        placeholder="Price per day ($)"
        type="number"
        value={price}
        onChange={(e) => onChangePrice(e.currentTarget.value)}
        size="md"
        radius={0}
        leftSectionPointerEvents="none"
        rightSection="EUR"
        classNames={{
          input:
            "placeholder:text-gray-400 placeholder:font-normal, placeholder:text-base focus:border-gray-600",
        }}
        styles={{
          section: { color: "black", paddingRight: "10px" },
          input: { textAlign: "center", fontSize: "18px" },
        }}
      />

      <p className=" text-gray-700 mt-5">
        We recommend that you use this price to maximize your earnings, but if
        you want to change it you can do so once you're successfully listed your
        car.
      </p>
    </div>
  );
}
