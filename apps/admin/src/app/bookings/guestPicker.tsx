import React, { useEffect, useState } from "react";
import { searchUsers } from "@/services/user.service";

type NewUserState = {
  full_name: string;
  email: string;
  phone: string;
  age: number | null;
  driver_license_issue?: string | "";
};

type GuestPickerProps = {
  cardCls: string;
  userId: string | null;
  setUserId: (id: string | null) => void;
  selectedUser: any | null;
  setSelectedUser: (u: any | null) => void;
};

export const GuestPicker: React.FC<GuestPickerProps> = ({
  cardCls,
  userId,
  setUserId,
  selectedUser,
  setSelectedUser,
}) => {
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserState>({
    full_name: "",
    email: "",
    phone: "",
    age: null,
    driver_license_issue: "",
  });

  const userForCard = selectedUser;

  // поиск юзеров
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (userSearch.trim().length < 2) {
          setUserResults([]);
          return;
        }
        const rows = await searchUsers(userSearch.trim());
        if (!ignore) setUserResults(rows);
      } catch {
        // игнорируем
      }
    })();
    return () => {
      ignore = true;
    };
  }, [userSearch]);

  return (
    <section className={`${cardCls} mt-6`}>
      <h2 className="text-base font-semibold text-gray-900">Customer</h2>
      <p className="mt-1 text-xs text-gray-500">
        Select existing user or add a new guest
      </p>

      <div className="mt-4 space-y-3">
        {/* Поиск существующего юзера */}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
            placeholder="Search by name / email / phone…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onBlur={() => setTimeout(() => setUserResults([]), 100)}
          />
          <button
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm active:scale-[.98]"
            onClick={() => setCreatingUser((v) => !v)}
          >
            {creatingUser ? "Cancel" : "New user"}
          </button>
        </div>

        {userResults.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100">
            {userResults.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${
                  userId === u.id ? "bg-gray-50" : ""
                }`}
                onClick={() => {
                  setUserId(u.id);
                  setSelectedUser(u);
                  setUserSearch("");
                  setUserResults([]);
                }}
              >
                <div className="font-medium text-gray-900">
                  {u.full_name ?? "—"}
                </div>
                <div className="text-xs text-gray-500">
                  {u.email ?? "—"} {u.phone ? `• ${u.phone}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Создание нового гостя (draft) */}
        {creatingUser && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                placeholder="Full name"
                value={newUser.full_name}
                onChange={(e) =>
                  setNewUser({ ...newUser, full_name: e.target.value })
                }
              />
              <input
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
              <input
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                placeholder="Phone"
                value={newUser.phone}
                onChange={(e) =>
                  setNewUser({ ...newUser, phone: e.target.value })
                }
              />
              <input
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                placeholder="Age (optional)"
                type="number"
                value={newUser.age ?? ""}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    age: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <input
                className="sm:col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-600 focus:outline-none"
                placeholder="Driver license issue date (YYYY-MM-DD)"
                value={newUser.driver_license_issue ?? ""}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    driver_license_issue: e.target.value,
                  })
                }
              />
            </div>

            <div className="mt-3 flex justify-end">
              <button
                className="rounded-lg border border-green-400 bg-white px-3 py-2 text-xs font-medium text-green-600 shadow-sm active:scale-[.98] disabled:border-gray-300 disabled:text-gray-400"
                onClick={() => {
                  setSelectedUser({
                    ...newUser,
                    id: null,
                    __draft: true,
                  });
                  setUserId(null);
                  setCreatingUser(false);
                  setUserSearch("");
                  setUserResults([]);
                }}
                disabled={
                  !newUser.full_name.trim() ||
                  !newUser.email.trim() ||
                  !newUser.phone.trim()
                }
              >
                Use this customer (draft)
              </button>
            </div>

            <div className="mt-2 text-[11px] text-gray-500">
              * Email и phone обязательны.
            </div>
          </div>
        )}

        {/* Выбранный юзер */}
        {userForCard && (
          <div className="rounded-lg border border-green-400 bg-green-50/60 p-3 text-sm text-gray-800 shadow-sm ring-1 ring-green-200/50 flex items-start gap-2">
            <div className="grow">
              <div className="font-medium text-gray-900">
                {userForCard.full_name ?? "—"}
              </div>
              <div className="text-xs text-gray-600">
                {userForCard.email ?? "—"}
                {userForCard.phone ? ` • ${userForCard.phone}` : ""}
                {userForCard.__draft && (
                  <span className="ml-2 text-amber-600">(draft)</span>
                )}
              </div>
            </div>
            <button
              className="text-[11px] font-medium text-green-500 hover:underline "
              onClick={() => {
                setUserId(null);
                setSelectedUser(null);
              }}
            >
              Change
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
