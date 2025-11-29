import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  uploadCarPhotos,
  updateCarPhotos,
  uploadCarVideo,
} from "@/services/car.service";
import { toast } from "sonner";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { SimpleGrid, Text, Button, Modal, Group } from "@mantine/core";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  TouchSensor,
  type DragEndEvent,
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

type VideoItem = {
  file?: File;
  url: string;
  isNew?: boolean;
};

type PhotoCategory = "cover" | "gallery" | "poster";

type PhotoToDelete = {
  category: PhotoCategory;
  photoId: string;
};

function SortablePhoto({
  photo,
  onRequestRemove,
}: {
  photo: PhotoItem;
  onRequestRemove: (photo: PhotoItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: photo.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : "auto",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group select-none"
    >
      {/* DRAG только на изображении */}
      <img
        src={photo.url}
        {...listeners}
        alt=""
        className="w-full h-[140px] object-cover rounded-md cursor-grab"
        draggable={false}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRequestRemove(photo);
        }}
        className="absolute top-1 right-1 z-50 bg-white text-black text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
      >
        ✕
      </button>
    </div>
  );
}

// ---------- helpers для оптимизации ----------

// максимум 2Мб на вход
const MAX_INPUT_IMAGE_BYTES = 2 * 1024 * 1024;
// целевой размер после оптимизации ~100кб
const TARGET_IMAGE_BYTES = 100 * 1024;

function changeExtToWebp(name: string) {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return name + ".webp";
  return name.substring(0, dot) + ".webp";
}

async function optimizeImage(file: File): Promise<File> {
  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("Image is larger than 2MB");
  }

  if (file.size <= TARGET_IMAGE_BYTES) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Cannot get canvas context"));
          return;
        }

        const maxWidth = 1600;
        const maxHeight = 1200;
        let width = img.width;
        let height = img.height;

        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;

        const exportTry = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Cannot export image"));
                return;
              }

              // Уложились в 100KB?
              if (blob.size <= TARGET_IMAGE_BYTES || quality <= 0.3) {
                const outFile = new File([blob], changeExtToWebp(file.name), {
                  type: "image/webp",
                });

                URL.revokeObjectURL(objectUrl);
                resolve(outFile);
                return;
              }

              // уменьшаем качество и пробуем снова
              quality -= 0.1;
              exportTry();
            },
            "image/webp",
            quality
          );
        };

        exportTry();
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cannot load image"));
    };

    img.src = objectUrl;
  });
}

// валидация видео
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_DURATION = 20; // секунд

async function validateVideo(file: File): Promise<void> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is larger than 10MB");
  }

  await new Promise<void>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      try {
        if (video.duration > MAX_VIDEO_DURATION) {
          cleanup();
          reject(new Error("Video is longer than 20 seconds"));
        } else {
          cleanup();
          resolve();
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Cannot read video"));
    };

    video.src = url;
  });
}

// ---------- основной компонент ----------

export default function Photos() {
  const { carId } = useParams();
  const { car, setCar } = useCarContext();

  const [coverPhotos, setCoverPhotos] = useState<PhotoItem[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<PhotoItem[]>([]);
  const [videoPoster, setVideoPoster] = useState<PhotoItem | null>(null);
  const [video, setVideo] = useState<VideoItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<PhotoToDelete | null>(
    null
  );

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const MAX_COVER_PHOTOS = 2;
  const MAX_GALLERY_PHOTOS = 6;
  const MAX_POSTER_PHOTOS = 1;

  useEffect(() => {
    if (!carId || !car) return;

    const loadedCover: PhotoItem[] =
      (car.coverPhotos || []).map((url: string, idx: number) => ({
        id: `cover-existing-${idx}`,
        url,
      })) ?? [];

    const loadedGallery: PhotoItem[] =
      (car.galleryPhotos || []).map((url: string, idx: number) => ({
        id: `gallery-existing-${idx}`,
        url,
      })) ?? [];

    const loadedPoster: PhotoItem | null = car.videoPoster
      ? {
          id: "poster-existing-0",
          url: car.videoPoster,
        }
      : null;

    const loadedVideo: VideoItem | null = car.videoUrl
      ? {
          url: car.videoUrl,
          isNew: false,
        }
      : null;

    setCoverPhotos(loadedCover);
    setGalleryPhotos(loadedGallery);
    setVideoPoster(loadedPoster);
    setVideo(loadedVideo);
  }, [carId, car]);

  // --------- DnD сортировка по категориям ---------

  const handleDragEnd =
    (category: PhotoCategory) =>
    (event: DragEndEvent): void => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const getList = () =>
        category === "cover"
          ? coverPhotos
          : category === "gallery"
          ? galleryPhotos
          : videoPoster
          ? [videoPoster]
          : [];

      const setList =
        category === "cover"
          ? setCoverPhotos
          : category === "gallery"
          ? setGalleryPhotos
          : (fn: (prev: PhotoItem[]) => PhotoItem[]) => {
              // для постера max1 — сортировка не особо нужна, но на всякий случай
              const result = fn(videoPoster ? [videoPoster] : []);
              setVideoPoster(result[0] ?? null);
            };

      const items = getList();
      const oldIndex = items.findIndex((p) => p.id === active.id);
      const newIndex = items.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      setList((prev) => arrayMove(prev, oldIndex, newIndex));
    };

  // --------- удаление ---------

  const handleConfirmRemove = () => {
    if (!photoToDelete) return;
    const { category, photoId } = photoToDelete;

    if (category === "cover") {
      setCoverPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else if (category === "gallery") {
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else if (category === "poster") {
      if (videoPoster && videoPoster.id === photoId) {
        setVideoPoster(null);
      }
    }

    setPhotoToDelete(null);
  };

  // --------- обработка картинок по категориям ---------

  const handleImageDrop =
    (category: PhotoCategory) => async (files: File[]) => {
      let currentList: PhotoItem[];
      let maxCount: number;

      if (category === "cover") {
        currentList = coverPhotos;
        maxCount = MAX_COVER_PHOTOS;
      } else if (category === "gallery") {
        currentList = galleryPhotos;
        maxCount = MAX_GALLERY_PHOTOS;
      } else {
        currentList = videoPoster ? [videoPoster] : [];
        maxCount = MAX_POSTER_PHOTOS;
      }

      const availableSlots = maxCount - currentList.length;

      if (availableSlots <= 0) {
        toast.error(
          category === "cover"
            ? `You can upload up to ${MAX_COVER_PHOTOS} photos for main & hover`
            : category === "gallery"
            ? `You can upload up to ${MAX_GALLERY_PHOTOS} gallery photos`
            : "Poster already uploaded"
        );
        return;
      }

      const slicedFiles = files.slice(0, availableSlots);
      const newItems: PhotoItem[] = [];

      for (let i = 0; i < slicedFiles.length; i++) {
        const file = slicedFiles[i];

        try {
          const optimized = await optimizeImage(file);
          const url = URL.createObjectURL(optimized);

          newItems.push({
            id: `${category}-new-${Date.now()}-${i}`,
            file: optimized,
            url,
            isNew: true,
          });
        } catch (e: any) {
          if (e?.message?.includes("2MB")) {
            toast.error("Image size must be <= 2MB");
          } else {
            console.error(e);
            toast.error("Error while optimizing image");
          }
        }
      }

      if (!newItems.length) return;

      if (category === "cover") {
        setCoverPhotos((prev) => [...prev, ...newItems]);
      } else if (category === "gallery") {
        setGalleryPhotos((prev) => [...prev, ...newItems]);
      } else {
        // poster — один файл
        setVideoPoster(newItems[0]);
      }
    };

  // --------- обработка видео ---------

  const handleVideoDrop = async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];

    try {
      await validateVideo(file);
      const url = URL.createObjectURL(file);
      setVideo({
        file,
        url,
        isNew: true,
      });
    } catch (e: any) {
      if (e?.message?.includes("10MB")) {
        toast.error("Video size must be <= 10MB");
      } else if (e?.message?.includes("20 seconds")) {
        toast.error("Video duration must be <= 20 seconds");
      } else {
        console.error(e);
        toast.error("Error while validating video");
      }
    }
  };

  const handleRemoveVideo = () => {
    if (video?.url && video.url.startsWith("blob:")) {
      URL.revokeObjectURL(video.url);
    }
    setVideo(null);
  };

  // --------- сохранение ---------

  const handleSave = async () => {
    if (!carId) return;
    setLoading(true);
    try {
      // Фотки
      const newCoverFiles = coverPhotos
        .filter((p) => p.isNew && p.file)
        .map((p) => p.file!) as File[];

      const newGalleryFiles = galleryPhotos
        .filter((p) => p.isNew && p.file)
        .map((p) => p.file!) as File[];

      const newPosterFiles =
        videoPoster && videoPoster.isNew && videoPoster.file
          ? [videoPoster.file]
          : [];

      const allNewFiles = [
        ...newCoverFiles,
        ...newGalleryFiles,
        ...newPosterFiles,
      ];

      let uploadedPhotoUrls: string[] = [];

      if (allNewFiles.length) {
        uploadedPhotoUrls = await uploadCarPhotos(allNewFiles, carId);
      }

      const urlsQueue = [...uploadedPhotoUrls];

      const finalCoverUrls = coverPhotos.map((p) =>
        p.isNew ? urlsQueue.shift()! : p.url
      );
      const finalGalleryUrls = galleryPhotos.map((p) =>
        p.isNew ? urlsQueue.shift()! : p.url
      );
      const finalPosterUrl = videoPoster
        ? videoPoster.isNew
          ? urlsQueue.shift()!
          : videoPoster.url
        : null;

      // 🎥 ВИДЕО
      let finalVideoUrl: string | null = car?.videoUrl ?? null; // старое значение, если было

      if (video && video.isNew && video.file) {
        finalVideoUrl = await uploadCarVideo(video.file, carId);
      }

      await updateCarPhotos(carId, {
        coverPhotos: finalCoverUrls,
        galleryPhotos: finalGalleryUrls,
        videoPoster: finalPosterUrl,
        videoUrl: finalVideoUrl,
      });

      // Обновляем локальный стейт
      setCoverPhotos(
        finalCoverUrls.map((url, idx) => ({
          id: `cover-existing-${idx}`,
          url,
        }))
      );
      setGalleryPhotos(
        finalGalleryUrls.map((url, idx) => ({
          id: `gallery-existing-${idx}`,
          url,
        }))
      );
      setVideoPoster(
        finalPosterUrl
          ? {
              id: "poster-existing-0",
              url: finalPosterUrl,
            }
          : null
      );
      setVideo(
        finalVideoUrl
          ? {
              url: finalVideoUrl,
              isNew: false,
            }
          : null
      );

      if (car) {
        setCar((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            coverPhotos: finalCoverUrls,
            galleryPhotos: finalGalleryUrls,
            videoPoster: finalPosterUrl,
            videoUrl: finalVideoUrl,
          };
        });
      }

      toast.success("Media saved");
    } catch (err) {
      console.error("Ошибка при сохранении медиа:", err);
      toast.error("Error while saving media");
    } finally {
      setLoading(false);
    }
  };

  // --------- JSX ---------

  return (
    <div className="mb-4 w-full xl:max-w-2xl">
      <h1 className="font-roboto text-xl md:text-2xl font-medium">
        Photos & Video
      </h1>
      <div className="border-b border-gray-100 mt-5 shadow-sm"></div>

      {/* COVER + HOVER */}
      <section className="pt-5">
        <h2 className="font-roboto text-lg font-medium">Main & hover photos</h2>
        <p className="text-sm text-gray-600 mt-1">
          Up to {MAX_COVER_PHOTOS} photos: the first one will be used as the
          main image, the second — on hover.
        </p>

        <Dropzone
          onDrop={handleImageDrop("cover")}
          onReject={() => {
            toast.error(
              `You can upload up to ${MAX_COVER_PHOTOS} main/hover photos`
            );
          }}
          accept={IMAGE_MIME_TYPE}
          loading={loading}
          multiple
          maxFiles={MAX_COVER_PHOTOS - coverPhotos.length}
          disabled={coverPhotos.length >= MAX_COVER_PHOTOS}
          className="mt-4"
        >
          <Text ta="center">
            {coverPhotos.length >= MAX_COVER_PHOTOS
              ? `Max ${MAX_COVER_PHOTOS} photos uploaded`
              : "Drag and drop images or click to select"}
          </Text>
          <Text ta="center" size="xs" c="dimmed">
            Max 2MB per image, will be optimized to ~100KB
          </Text>
        </Dropzone>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd("cover")}
        >
          <SortableContext
            items={coverPhotos.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <SimpleGrid cols={{ base: 2, sm: 2 }} mt="lg">
              {coverPhotos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <SortablePhoto
                    photo={photo}
                    onRequestRemove={(p) =>
                      setPhotoToDelete({ category: "cover", photoId: p.id })
                    }
                  />
                </div>
              ))}
            </SimpleGrid>
          </SortableContext>
        </DndContext>
      </section>

      {/* GALLERY */}
      <section className="pt-8">
        <h2 className="font-roboto text-lg font-medium">Gallery photos</h2>
        <p className="text-sm text-gray-600 mt-1">
          Up to {MAX_GALLERY_PHOTOS} photos for the car catalog.
        </p>

        <Dropzone
          onDrop={handleImageDrop("gallery")}
          onReject={() => {
            toast.error(
              `You can upload up to ${MAX_GALLERY_PHOTOS} gallery photos`
            );
          }}
          accept={IMAGE_MIME_TYPE}
          loading={loading}
          multiple
          maxFiles={MAX_GALLERY_PHOTOS - galleryPhotos.length}
          disabled={galleryPhotos.length >= MAX_GALLERY_PHOTOS}
          className="mt-4"
        >
          <Text ta="center">
            {galleryPhotos.length >= MAX_GALLERY_PHOTOS
              ? `Max ${MAX_GALLERY_PHOTOS} photos uploaded`
              : "Drag and drop images or click to select"}
          </Text>
          <Text ta="center" size="xs" c="dimmed">
            Max 2MB per image, will be optimized to ~100KB
          </Text>
        </Dropzone>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd("gallery")}
        >
          <SortableContext
            items={galleryPhotos.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <SimpleGrid cols={{ base: 2, sm: 3 }} mt="lg">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <SortablePhoto
                    photo={photo}
                    onRequestRemove={(p) =>
                      setPhotoToDelete({ category: "gallery", photoId: p.id })
                    }
                  />
                </div>
              ))}
            </SimpleGrid>
          </SortableContext>
        </DndContext>
      </section>

      {/* VIDEO POSTER */}
      <section className="pt-8">
        <h2 className="font-roboto text-lg font-medium">Video poster</h2>
        <p className="text-sm text-gray-600 mt-1">
          One image to be used as a poster/thumbnail for the video.
        </p>

        <Dropzone
          onDrop={handleImageDrop("poster")}
          onReject={() => {
            toast.error("You can upload only 1 poster image");
          }}
          accept={IMAGE_MIME_TYPE}
          loading={loading}
          multiple={false}
          maxFiles={videoPoster ? 0 : 1}
          disabled={!!videoPoster}
          className="mt-4"
        >
          <Text ta="center">
            {videoPoster
              ? "Poster uploaded"
              : "Drag and drop an image or click to select"}
          </Text>
          <Text ta="center" size="xs" c="dimmed">
            Max 2MB, will be optimized to ~100KB
          </Text>
        </Dropzone>

        {videoPoster && (
          <div className="mt-4 max-w-xs">
            <img
              src={videoPoster.url}
              alt="Video poster"
              className="w-full h-[160px] object-cover rounded-md"
            />
            <button
              onClick={() =>
                setPhotoToDelete({
                  category: "poster",
                  photoId: videoPoster.id,
                })
              }
              className="mt-2 text-xs text-red-600"
            >
              Remove poster
            </button>
          </div>
        )}
      </section>

      {/* VIDEO */}
      <section className="pt-8">
        <h2 className="font-roboto text-lg font-medium">Video</h2>
        <p className="text-sm text-gray-600 mt-1">
          One video up to 10MB and 20 seconds.
        </p>

        <Dropzone
          onDrop={handleVideoDrop}
          onReject={() => {
            toast.error("Invalid video file");
          }}
          accept={["video/mp4", "video/webm", "video/ogg"]}
          loading={loading}
          multiple={false}
          maxFiles={video ? 0 : 1}
          disabled={!!video}
          className="mt-4"
        >
          <Text ta="center">
            {video
              ? "Video uploaded"
              : "Drag and drop a video or click to select"}
          </Text>
          <Text ta="center" size="xs" c="dimmed">
            Max 10MB, duration up to 20 seconds
          </Text>
        </Dropzone>

        {video && (
          <div className="mt-4 max-w-xs">
            <video
              src={video.url}
              controls
              className="w-full rounded-md"
            ></video>
            <button
              onClick={handleRemoveVideo}
              className="mt-2 text-xs text-red-600"
            >
              Remove video
            </button>
          </div>
        )}
      </section>

      {/* SAVE */}
      <div className="mt-8 text-center">
        <button
          onClick={handleSave}
          className="bg-black text-white py-2 px-4 rounded w-full sm:w-auto disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>

      {/* MODAL DELETE */}
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
