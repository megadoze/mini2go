// app/api/upload-driver-license/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // поправь путь если другой

const BUCKET = "driver-licenses";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const f = file as File;

    // расширение из имени файла
    const origName = f.name || "file";
    const ext =
      (origName.split(".").pop() || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${ext}`;

    // путь внутри бакета
    const filePath = fileName; // или `bookings/${fileName}` если хочешь подпапку

    const { data, error } = await supabaseServer.storage
      .from(BUCKET)
      .upload(filePath, f, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("[upload-driver-license] supabase error:", error);
      return NextResponse.json(
        { error: error.message || "Upload failed" },
        { status: 500 }
      );
    }

    // data.path — относительный путь в бакете
    return NextResponse.json({
      path: data?.path, // это мы будем хранить в profiles.driver_license_file_url
      fileName: origName,
    });
  } catch (err: any) {
    console.error("[upload-driver-license] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
