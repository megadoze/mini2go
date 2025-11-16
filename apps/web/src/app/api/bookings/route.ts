// app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // поправь путь, если у тебя другой

type DriverPayload = {
  name: string;
  dob: string | null;
  licenseNumber: string;
  licenseExpiry: string | null;
  phone: string;
  email: string;
  licenseFileName: string | null;
  licenseFileUrl: string | null;
};

type BookingPayload = {
  carId: string;
  start: string;
  end: string;
  pricePerDay: number;
  priceTotal: number;
  currency: string;
  deposit: number;

  deliveryType: "car_address" | "by_address";
  deliveryFee: number;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLong: number | null;

  extras: string[]; // IDs допов
  driver: DriverPayload;
};

// посчитать возраст по дате рождения (для profiles.age)
function calcAge(dobIso: string | null): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as Partial<BookingPayload>;

    if (!raw.carId || !raw.start || !raw.end) {
      return NextResponse.json(
        { error: "carId, start, end are required" },
        { status: 400 }
      );
    }

    const pricePerDay = Number(raw.pricePerDay ?? 0);
    const priceTotal = Number(raw.priceTotal ?? 0);
    const deposit = Number(raw.deposit ?? 0);
    const deliveryFee = Number(raw.deliveryFee ?? 0);

    const currency = raw.currency || "EUR";
    const deliveryType: "car_address" | "by_address" =
      raw.deliveryType === "by_address" ? "by_address" : "car_address";

    const extras = Array.isArray(raw.extras) ? raw.extras : [];

    const driver: DriverPayload = {
      name: String(raw.driver?.name ?? "").trim(),
      dob: raw.driver?.dob ?? null,
      licenseNumber: String(raw.driver?.licenseNumber ?? "").trim(),
      licenseExpiry: raw.driver?.licenseExpiry ?? null,
      phone: String(raw.driver?.phone ?? "").trim(),
      email: String(raw.driver?.email ?? "")
        .trim()
        .toLowerCase(),
      licenseFileName: raw.driver?.licenseFileName ?? null,
      licenseFileUrl: raw.driver?.licenseFileUrl ?? null,
    };

    if (!driver.email) {
      return NextResponse.json(
        { error: "Driver email is required" },
        { status: 400 }
      );
    }

    // ---------- 1. UPSERT ПРОФИЛЯ ----------

    const age = calcAge(driver.dob);
    let profileId: string | null = null;

    // ищем по email (и/или телефону — если хочешь, можно добавить or)
    const { data: existingProfiles, error: profileSelectError } =
      await supabaseServer
        .from("profiles")
        .select("*")
        .eq("email", driver.email)
        .limit(1);

    if (profileSelectError) {
      console.error("profiles select error", profileSelectError);
      return NextResponse.json(
        { error: "Failed to check existing profile" },
        { status: 500 }
      );
    }

    const existingProfile = existingProfiles?.[0] ?? null;

    if (existingProfile) {
      // обновляем только пустые поля, чтобы не затирать то, что уже ввёл юзер в кабинете
      const update: Record<string, any> = {};

      if (!existingProfile.full_name && driver.name) {
        update.full_name = driver.name;
      }
      if (!existingProfile.phone && driver.phone) {
        update.phone = driver.phone;
      }
      if (age != null && !existingProfile.age) {
        update.age = age;
      }

      if (!existingProfile.driver_dob && driver.dob) {
        update.driver_dob = new Date(driver.dob).toISOString();
      }
      if (!existingProfile.driver_license_number && driver.licenseNumber) {
        update.driver_license_number = driver.licenseNumber;
      }
      if (!existingProfile.driver_license_expiry && driver.licenseExpiry) {
        update.driver_license_expiry = new Date(
          driver.licenseExpiry
        ).toISOString();
      }
      if (!existingProfile.driver_license_file_url && driver.licenseFileName) {
        update.driver_license_file_url = driver.licenseFileUrl;
      }

      if (Object.keys(update).length > 0) {
        const { data, error } = await supabaseServer
          .from("profiles")
          .update(update)
          .eq("id", existingProfile.id)
          .select()
          .single();

        if (error) {
          console.error("profiles update error", error);
          return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
          );
        }

        profileId = data.id;
      } else {
        profileId = existingProfile.id;
      }
    } else {
      // создаём новый профиль
      const insertProfile: Record<string, any> = {
        full_name: driver.name || null,
        email: driver.email, // NOT NULL + UNIQUE
        phone: driver.phone || null,
        age,
        driver_dob: driver.dob ? new Date(driver.dob).toISOString() : null,
        driver_license_number: driver.licenseNumber || null,
        driver_license_expiry: driver.licenseExpiry
          ? new Date(driver.licenseExpiry).toISOString()
          : null,
        driver_license_file_url: driver.licenseFileUrl || null,

        // ВАЖНО: явно false
        is_admin: false,
        is_host: false,
        status: "active",
      };

      const { data, error } = await supabaseServer
        .from("profiles")
        .insert(insertProfile)
        .select()
        .single();

      if (error) {
        console.error("profiles insert error", error);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }

      profileId = data.id;
    }

    // ---------- 2. СОЗДАЁМ БРОНЬ ----------

    const startAt = new Date(raw.start);
    const endAt = new Date(raw.end);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid start or end date" },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseServer
      .from("bookings")
      .insert({
        user_id: profileId, // <-- теперь заполняем
        car_id: raw.carId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        price_per_day: pricePerDay,
        price_total: priceTotal,
        deposit,
        currency,
        delivery_type: deliveryType,
        delivery_fee: deliveryFee,
        delivery_address: raw.deliveryAddress || null,
        delivery_lat: raw.deliveryLat,
        delivery_long: raw.deliveryLong,

        status: "onApproval", // <- как ты и хотел
        mark: "booking", // <- а не JSON с драйвером
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error("bookings insert error", bookingError);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    // ---------- 3. СОХРАНЯЕМ EXTRAS В booking_extras ----------

    if (extras.length > 0) {
      // минимальный вариант: просто пишем extra_id, qty=1, price/total=0
      // если хочешь подтягивать реальные price/title с сервера —
      // можно здесь сделать SELECT из таблицы extras по этим id.
      const toInsert = extras.map((extraId) => ({
        booking_id: booking.id,
        extra_id: extraId,
        title: null,
        qty: 1,
        price: 0,
        total: 0,
        price_type: null,
      }));

      const { error: extrasError } = await supabaseServer
        .from("booking_extras")
        .insert(toInsert);

      if (extrasError) {
        console.error("booking_extras insert error", extrasError);
        // бронь уже есть — поэтому не откатываем, просто логируем и отдаём ок
      }
    }

    return NextResponse.json(
      {
        bookingId: booking.id,
        userId: profileId,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Bookings API unhandled error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
