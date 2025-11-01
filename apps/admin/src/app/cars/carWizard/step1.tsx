import { Radio, Stack } from "@mantine/core";
import { optionsOwnerCar } from "@/constants/carOptions";

type Step1Props = {
  owner: string;
  onChangeOwner: (value: string) => void;
};

export default function Step1({ owner, onChangeOwner }: Step1Props) {
  // те же карточки, что были у тебя в визарде
  const cards = optionsOwnerCar.map((item) => (
    <Radio.Card
      radius="md"
      value={item.name}
      key={item.name}
      className="overflow-hidden radio-card"
    >
      <div className="p-4 flex gap-4 items-center hover:bg-gray-50 transition ease-in-out">
        <Radio.Indicator color="black" />
        <div>
          <p className="font-medium">{item.label}</p>
          <p className="text-sm text-gray-700">{item.description}</p>
        </div>
      </div>
    </Radio.Card>
  ));

  return (
    <div>
      <p className="font-bold text-lg">Who owns the car?</p>

      <Radio.Group
        value={owner}
        onChange={(value) => {
          // Mantine Radio.Group даёт value: string
          onChangeOwner(value);
        }}
      >
        <Stack pt="md" gap="xs">
          {cards}
        </Stack>
      </Radio.Group>
    </div>
  );
}
