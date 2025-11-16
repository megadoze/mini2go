// services/uploadDriverLicense.ts
export async function uploadDriverLicenseFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload-driver-license", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    throw new Error(data?.error || "License upload failed");
  }

  const data = await res.json();

  return {
    storagePath: data.path as string, // относительный путь в бакете
    originalName: data.fileName as string,
  };
}
