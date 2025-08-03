import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { uploadCarPhotos, updateCarPhotos } from "@/services/car.service";
import { toast } from "sonner";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { Image, SimpleGrid, Text, Button, Modal, Group } from "@mantine/core";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  TouchSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCarContext } from "@/context/carContext";

type PhotoItem = {
  id: string;
  file?: File;
  url: string;
  isNew?: boolean;
};

function SortablePhoto({
  photo,
  index,
  onRequestRemove,
}: {
  photo: PhotoItem;
  index: number;
  onRequestRemove: (photo: PhotoItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: "relative",
    cursor: "grab",
    overflow: "visible",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="select-none touch-none" // Tailwind-классы для отключения выделения и жестов
      onContextMenu={(e) => e.preventDefault()}
    >
      <div {...listeners}>
        <Image
          src={photo.url}
          radius="md"
          h="140"
          alt={`photo-${index}`}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          className="select-none touch-none"
        />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRequestRemove(photo);
        }}
        className="absolute top-1 right-1 bg-white text-black text-xs px-1 rounded z-20 opacity-0 group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

export default function Photos() {
  const { id } = useParams();
  const { car, setCar } = useCarContext();

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<PhotoItem | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // чтобы не срабатывало случайно при скролле
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        // const car = await fetchCarById(id);
        const loadedPhotos: PhotoItem[] = (car.photos || []).map(
          (url: string, idx: number) => ({
            id: `existing-${idx}`,
            url,
          })
        );
        setPhotos(loadedPhotos);
      } catch (err) {
        console.error("Ошибка при загрузке авто:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDrop = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);
      setPhotos((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleConfirmRemove = () => {
    if (!photoToDelete) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
    setPhotoToDelete(null);
  };

  const handleSave = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const newFiles =
        photos.filter((p) => p.isNew && p.file).map((p) => p.file!) || [];
      const uploadedUrls = await uploadCarPhotos(newFiles, id);
      const finalUrls = photos.map((p) =>
        p.isNew ? uploadedUrls.shift()! : p.url
      );
      await updateCarPhotos(id, finalUrls);
      setPhotos(finalUrls.map((url, idx) => ({ id: `existing-${idx}`, url })));
      if (car) {
        setCar((prev) => ({
          ...prev!,
          photos: finalUrls,
        }));
      }
    } catch (err) {
      console.error("Ошибка при сохранении фото:", err);
    } finally {
      setLoading(false);
    }
  };

  const MAX_PHOTOS = 3;

  const handleDropzone = (files: File[]) => {
    const availableSlots = MAX_PHOTOS - photos.length;

    if (availableSlots <= 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} photos`);
      return;
    }

    const slicedFiles = files.slice(0, availableSlots);

    const newItems: PhotoItem[] = slicedFiles.map((file, idx) => ({
      id: `new-${Date.now()}-${idx}`,
      file,
      url: URL.createObjectURL(file),
      isNew: true,
    }));

    setPhotos((prev) => [...prev, ...newItems]);
  };

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="text-2xl font-bold font-openSans">Photos</h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>
      <p className="pt-5">
        Upload up to {MAX_PHOTOS} photos of your car. You may not use stock
        photos. Drag to reorder.
      </p>

      <Dropzone
        onDrop={handleDropzone}
        onReject={() => {
          toast.error(`You can upload up to ${MAX_PHOTOS} photos`);
        }}
        accept={IMAGE_MIME_TYPE}
        loading={loading}
        loaderProps={{ color: "gray", type: "oval", size: "sm" }}
        multiple
        maxFiles={MAX_PHOTOS - photos.length}
        disabled={photos.length >= MAX_PHOTOS}
        className="mt-4"
      >
        <Text ta="center">
          {photos.length >= MAX_PHOTOS
            ? `Max ${MAX_PHOTOS} photos uploaded`
            : "Drag and drop images or click to select"}
        </Text>
      </Dropzone>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDrop}
      >
        <SortableContext
          items={photos.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <SimpleGrid cols={{ base: 2, sm: 3 }} mt="lg">
            {photos.map((photo, index) => (
              <div key={photo.id} className="group relative">
                <SortablePhoto
                  photo={photo}
                  index={index}
                  onRequestRemove={(p) => {
                    setPhotoToDelete(p);
                  }}
                />
              </div>
            ))}
          </SimpleGrid>
        </SortableContext>
      </DndContext>

      <div className="mt-8 text-center">
        <button
          onClick={handleSave}
          disabled={loading || photos.length === 0}
          className="bg-black text-white py-2 px-4 rounded w-full sm:w-auto disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>

      <Modal
        opened={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        title="Удалить фото?"
        centered
      >
        <Text>Are you sure you want to delete this photo?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setPhotoToDelete(null)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleConfirmRemove}>
            Delete
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
