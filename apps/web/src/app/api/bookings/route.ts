// app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

type BookingExtraClient = {
  extraId: string;
  title?: string;
  qty?: number;
  price: number;
  total: number;
  priceType?: string | null;
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

  extras: BookingExtraClient[];
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

    // ---------- EXTRAS: нормализуем то, что пришло с клиента ----------
    const extrasRaw = Array.isArray(raw.extras) ? raw.extras : [];

    const bookingExtras: BookingExtraClient[] = extrasRaw
      .map((ex: any) => {
        if (!ex || typeof ex !== "object") return null;
        if (!ex.extraId) return null;

        const price = Number(ex.price ?? 0);
        const total = Number(ex.total ?? 0);

        if (Number.isNaN(price) || Number.isNaN(total)) return null;

        return {
          extraId: String(ex.extraId),
          title: ex.title ?? "",
          qty: typeof ex.qty === "number" ? ex.qty : 1,
          price,
          total,
          priceType: ex.priceType ?? null,
        } as BookingExtraClient;
      })
      .filter((ex): ex is BookingExtraClient => !!ex);

    // ---------- DRIVER ----------
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
      if (!existingProfile.driver_license_file_url && driver.licenseFileUrl) {
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
      const insertProfile: Record<string, any> = {
        full_name: driver.name || null,
        email: driver.email,
        phone: driver.phone || null,
        age,
        driver_dob: driver.dob ? new Date(driver.dob).toISOString() : null,
        driver_license_number: driver.licenseNumber || null,
        driver_license_expiry: driver.licenseExpiry
          ? new Date(driver.licenseExpiry).toISOString()
          : null,
        driver_license_file_url: driver.licenseFileUrl || null,

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
        user_id: profileId,
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
        status: "onApproval",
        mark: "booking",
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

    if (bookingExtras.length > 0) {
      const toInsert = bookingExtras.map((ex) => ({
        booking_id: booking.id,
        extra_id: ex.extraId,
        title: ex.title ?? "",
        qty: ex.qty ?? 1,
        price: ex.price,
        total: ex.total,
        price_type: ex.priceType ?? null,
      }));

      const { error: extrasError } = await supabaseServer
        .from("booking_extras")
        .insert(toInsert);

      if (extrasError) {
        console.error("booking_extras insert error", extrasError);
        // бронь уже есть — не заваливаем запрос
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
