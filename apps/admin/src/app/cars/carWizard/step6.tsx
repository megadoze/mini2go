import { Image, SimpleGrid } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { type Key } from "react";
import { toast } from "sonner";

type PhotoItem = {
  id: string;
  file?: File;
  url: string;
  isNew?: boolean;
};

export default function Step6({ photos, setPhotos, setForm, loading }: any) {
  const MAX_PHOTOS = 3;

  console.log(photos);

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

    setPhotos((prev: any) => [...prev, ...newItems]);
    setForm((prev: { photos: any; }) => ({
      ...prev,
      photos: [...prev.photos, ...slicedFiles],
    }));
  };

  return (
    <>
      <div className="space-y-2">
        <p className="font-bold text-lg mt-5 mb-5">
          Upload up to 3 photos of your car
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
          maxFiles={Math.max(0, MAX_PHOTOS - photos.length)}
          disabled={photos.length >= MAX_PHOTOS}
          className="mt-4"
        >
          <p className=" text-center">
            {photos.length >= MAX_PHOTOS
              ? `Max ${MAX_PHOTOS} photos uploaded`
              : "Drag and drop images or click to select"}
          </p>
        </Dropzone>

        <SimpleGrid
          cols={{ base: 2, sm: 3 }}
          spacing="md"
          mt={photos.length > 0 ? "md" : 0}
        >
          {photos.map(
            (
              item: {
                isNew: any;
                file: Blob | MediaSource;
                url: any;
                id: Key | null | undefined;
              },
              index: any
            ) => {
              const imageUrl =
                item.isNew && item.file
                  ? URL.createObjectURL(item.file)
                  : item.url;

              return (
                <div key={item.id} className="relative rounded overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={`preview-${index}`}
                    className="object-cover w-full h-32"
                    onLoad={() => {
                      if (item.isNew && item.file) {
                        URL.revokeObjectURL(imageUrl);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      setPhotos((prev: PhotoItem[]) => {
                        const next = prev.filter((_, idx) => idx !== index);
                        // синхроним form.photos (который держит File[])
                        setForm((formPrev: any) => ({
                          ...formPrev,
                          photos: next
                            .filter((it) => it.isNew && it.file) // только новые файлы
                            .map((it) => it.file),
                        }));
                        return next;
                      });
                    }}
                    className="absolute top-1 right-1 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-gray-100"
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              );
            }
          )}
        </SimpleGrid>
      </div>
    </>
  );
}
