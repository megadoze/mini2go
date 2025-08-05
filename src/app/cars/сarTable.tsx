import { useState } from "react";
import type { CarWithRelations } from "@/types/carWithRelations";
import { Modal, Button } from "@mantine/core";
import { highlightMatch } from "@/utils/highlightMatch";
import { NavLink } from "react-router-dom";

type Props = {
  cars: CarWithRelations[];
  search: string;
  onDelete: (car: CarWithRelations) => void;
};

export default function CarListView({ cars, search, onDelete }: Props) {
  const [selected, setSelected] = useState<CarWithRelations | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Modal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удаление автомобиля"
        centered
      >
        <p className="mb-4">Вы уверены, что хотите удалить этот автомобиль?</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 transition"
            onClick={() => setConfirmDelete(false)}
          >
            Отмена
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 transition"
            onClick={() => {
              if (selected) onDelete(selected);
              setConfirmDelete(false);
            }}
          >
            Удалить
          </button>
        </div>
      </Modal>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {cars.map((car) => (
          <NavLink
            key={car.id}
            to={`/cars/${car.id}`}
            className="block border border-zinc-200 rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition cursor-pointer relative"
          >
            <div className="flex gap-4">
              {car.photos?.[0] ? (
                <img
                  src={car.photos[0]}
                  alt="Фото авто"
                  className="w-32 h-20 object-cover rounded-md"
                />
              ) : (
                <div className="w-32 h-20 bg-gray-100 flex items-center justify-center">
                  —
                </div>
              )}
              <div>
                <div className="font-bold text-base leading-5">
                  {highlightMatch(car.models?.brands?.name, search)}{" "}
                  {highlightMatch(car.models?.name, search)}
                </div>
                <div className=" border border-black rounded-sm text-black font-medium px-1 w-fit text-sm  mt-1">
                  {highlightMatch(car.licensePlate ?? "", search)}
                </div>
                <div className="text-sm text-zinc-600">
                  {car.locations?.name}
                </div>
              </div>
            </div>
            <div className="mt-2 text-right">
              <Button
                variant="filled"
                color="red"
                size="xs"
                radius="xs"
                onClick={(e) => {
                  e.preventDefault(); // отменяет переход
                  e.stopPropagation(); // останавливает всплытие
                  setSelected(car);
                  setConfirmDelete(true);
                }}
                className=""
              >
                Удалить
              </Button>
            </div>
          </NavLink>
        ))}
      </div>
    </>
  );
}
