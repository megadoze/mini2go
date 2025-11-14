// function BookingDrawer({
//   open,
//   onClose,
//   car,
//   start,
//   end,
//   days,
//   onConfirm,
//   onChangeDates,
//   isMobile,
// }: {
//   open: boolean;
//   onClose: () => void;
//   car: CarWithRelations;
//   start: string;
//   end: string;
//   days: number;
//   onConfirm: (opts: Record<string, string | number | boolean | string>) => void;
//   onChangeDates: (val: { startAt: Date | null; endAt: Date | null }) => void;
//   isMobile: boolean;
// }) {
//   const OPTION_PRICES = {
//     wash: 15,
//     unlimited: 10,
//     delivery: 30,
//   } as const;

//   const ACCEPTED_VERSION = "v1.0";

//   const shouldReduceMotion = useReducedMotion();

//   const [wash, setWash] = useState(false);
//   const [unlimited, setUnlimited] = useState(false);
//   const [delivery, setDelivery] = useState(false);
//   const [deliveryAddress, setDeliveryAddress] = useState("");

//   // DRIVER fields
//   const [driverName, setDriverName] = useState("");
//   const [driverDob, setDriverDob] = useState<string | null>(null);
//   const [driverLicense, setDriverLicense] = useState("");
//   const [driverLicenseExpiry, setDriverLicenseExpiry] = useState<string | null>(
//     null
//   );
//   const [driverPhone, setDriverPhone] = useState("");
//   const [driverEmail, setDriverEmail] = useState("");

//   // license file / dropzone
//   const [licenseFile, setLicenseFile] = useState<File | null>(null);
//   const [licensePreview, setLicensePreview] = useState<string | null>(null);
//   const [uploadProgress, setUploadProgress] = useState<number | null>(null);
//   const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
//   const [dragActive, setDragActive] = useState(false);

//   // terms/errors/submitting
//   const [acceptedTerms, setAcceptedTerms] = useState(false);
//   const [acceptedTs, setAcceptedTs] = useState<string | null>(null);
//   const [errors, setErrors] = useState<Record<string, string>>({});
//   const [submitting, setSubmitting] = useState(false);

//   // refs/focus
//   const panelRef = useRef<HTMLDivElement | null>(null);
//   const formRef = useRef<HTMLDivElement | null>(null);
//   const firstFocusRef = useRef<HTMLInputElement | null>(null);
//   const lastFocusRef = useRef<HTMLButtonElement | null>(null);

//   // hero
//   const hero = (car?.photos || []).filter(Boolean)[0] ?? "/images/aceman2.webp";

//   // block scroll while open
//   useEffect(() => {
//     if (!open) return;

//     const prevOverflow = document.body.style.overflow;
//     document.body.style.overflow = "hidden";

//     // touchmove guard — разрешаем прокрутку, если событие происходит внутри panelRef
//     const onTouchMove = (e: TouchEvent) => {
//       const panel = panelRef.current;
//       if (!panel) {
//         e.preventDefault();
//         return;
//       }
//       // если тач внутри панели — не блокируем
//       if (panel.contains(e.target as Node)) return;
//       // иначе — блокируем (чтобы фон не скроллился)
//       e.preventDefault();
//     };

//     document.addEventListener("touchmove", onTouchMove, { passive: false });

//     return () => {
//       document.body.style.overflow = prevOverflow;
//       document.removeEventListener("touchmove", onTouchMove);
//     };
//   }, [open]);

//   // prefill
//   useEffect(() => {
//     if (!open) return;
//     try {
//       const possible = (window as any).__USER__;
//       if (possible) {
//         if (possible.name) setDriverName(possible.name);
//         if (possible.email) setDriverEmail(possible.email);
//         if (possible.phone) setDriverPhone(possible.phone);
//         if (possible.license) setDriverLicense(possible.license);
//       }
//     } catch {}
//   }, [open]);

//   // reset on open
//   useEffect(() => {
//     if (!open) return;
//     setWash(false);
//     setUnlimited(false);
//     setDelivery(false);
//     setDeliveryAddress("");
//     setErrors({});
//     setLicenseFile(null);
//     setLicensePreview(null);
//     setAcceptedTerms(false);
//     setAcceptedTs(null);
//     setSubmitting(false);
//     setUploadProgress(null);
//     setUploadedUrl(null);
//     requestAnimationFrame(() => {
//       try {
//         firstFocusRef.current?.focus?.({ preventScroll: true });
//       } catch {
//         // старые браузеры могут не поддерживать объект опций — fallback
//         firstFocusRef.current?.focus?.();
//       }
//     });
//   }, [open]);

//   // preview + mock upload
//   useEffect(() => {
//     if (!licenseFile) {
//       setLicensePreview(null);
//       setUploadProgress(null);
//       setUploadedUrl(null);
//       return;
//     }

//     const url = URL.createObjectURL(licenseFile);
//     setLicensePreview(url);

//     let cancelled = false;
//     (async () => {
//       setUploadProgress(0);
//       for (let i = 1; i <= 20; i++) {
//         if (cancelled) return;
//         // small delay to show progress
//         // eslint-disable-next-line no-await-in-loop
//         await new Promise((r) => setTimeout(r, 60));
//         setUploadProgress(Math.round((i / 20) * 100));
//       }
//       if (cancelled) return;
//       setUploadedUrl(`/uploads/${Date.now()}_${licenseFile.name}`);
//       setUploadProgress(100);
//     })();

//     return () => {
//       cancelled = true;
//       URL.revokeObjectURL(url);
//     };
//   }, [licenseFile]);

//   useEffect(() => {
//     if (uploadedUrl) {
//       setErrors((prev) => {
//         const next = { ...prev };
//         if (next.driverLicenseFile) delete next.driverLicenseFile;
//         return next;
//       });
//     }
//   }, [uploadedUrl]);

//   const optionsTotal = useMemo(() => {
//     const perDay = unlimited ? OPTION_PRICES.unlimited * Math.max(1, days) : 0;
//     const flat =
//       (wash ? OPTION_PRICES.wash : 0) + (delivery ? OPTION_PRICES.delivery : 0);
//     return perDay + flat;
//   }, [wash, unlimited, delivery, days]);

//   const baseTotal = Math.max(1, days) * (car.price || 0);
//   const grandTotal = baseTotal + optionsTotal;

//   function isValidEmail(value: string) {
//     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
//   }

//   const validate = useCallback(() => {
//     const e: Record<string, string> = {};
//     if (!driverName.trim() || driverName.trim().length < 2)
//       e.driverName = "Please enter full name";
//     if (!driverLicense.trim() || driverLicense.trim().length < 3)
//       e.driverLicense = "Enter license number";
//     if (!driverPhone.trim() || driverPhone.trim().length < 6)
//       e.driverPhone = "Enter phone number";
//     if (!driverEmail.trim() || !isValidEmail(driverEmail))
//       e.driverEmail = "Enter a valid email address";
//     if (!acceptedTerms) e.acceptedTerms = "You must accept Terms & Conditions";
//     if (licenseFile && (!uploadedUrl || (uploadProgress ?? 0) < 100)) {
//       e.driverLicenseFile =
//         "License upload in progress. Please wait until it completes.";
//     }
//     if (delivery && !deliveryAddress.trim())
//       e.deliveryAddress = "Enter delivery address";
//     setErrors(e);
//     return Object.keys(e).length === 0;
//   }, [
//     driverName,
//     driverLicense,
//     driverPhone,
//     driverEmail,
//     acceptedTerms,
//     licenseFile,
//     uploadedUrl,
//     uploadProgress,
//     delivery,
//     deliveryAddress,
//   ]);

//   // focus trap
//   const onKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key !== "Tab") return;
//     const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
//       "a[href], button:not([disabled]), textarea, input, select"
//     );
//     if (!focusable || focusable.length === 0) return;
//     const first = focusable[0];
//     const last = focusable[focusable.length - 1];
//     if (e.shiftKey && document.activeElement === first) {
//       e.preventDefault();
//       (last as HTMLElement).focus();
//     } else if (!e.shiftKey && document.activeElement === last) {
//       e.preventDefault();
//       (first as HTMLElement).focus();
//     }
//   };

//   const canSubmit =
//     driverName.trim().length > 1 &&
//     driverLicense.trim().length > 2 &&
//     driverPhone.trim().length > 5 &&
//     isValidEmail(driverEmail) &&
//     acceptedTerms &&
//     !(licenseFile && (!uploadedUrl || (uploadProgress ?? 0) < 100)) &&
//     (!delivery || deliveryAddress.trim().length > 0);

//   const handleConfirm = async () => {
//     if (submitting) return;
//     const ok = validate();
//     if (!ok) return;
//     setSubmitting(true);
//     try {
//       const opts = {
//         wash: wash ? 1 : 0,
//         unlimited: unlimited ? 1 : 0,
//         delivery: delivery ? 1 : 0,
//         delivery_address: delivery ? deliveryAddress.trim() : "",
//         driver_name: driverName.trim(),
//         driver_dob: driverDob ? new Date(driverDob).toISOString() : "",
//         driver_license: driverLicense.trim(),
//         driver_license_expiry: driverLicenseExpiry
//           ? new Date(driverLicenseExpiry).toISOString()
//           : "",
//         driver_phone: driverPhone.trim(),
//         driver_email: driverEmail.trim(),
//         driver_license_file_name: licenseFile ? licenseFile.name : "",
//         accepted_terms: acceptedTerms ? 1 : 0,
//         accepted_ts: acceptedTs ?? new Date().toISOString(),
//         accepted_version: ACCEPTED_VERSION,
//       } as Record<string, string | number>;
//       await Promise.resolve(onConfirm(opts));
//       onClose();
//     } catch (err) {
//       console.error("Booking failed", err);
//       setErrors((prev) => ({ ...prev, submit: "Booking failed. Try again." }));
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   // dropzone handlers
//   const handleFiles = (f: File | null) => {
//     if (!f) return;
//     setLicenseFile(f);
//     setUploadedUrl(null);
//     setErrors((prev) => {
//       const next = { ...prev };
//       delete next.driverLicenseFile;
//       return next;
//     });
//   };
//   const onDrop = (e: React.DragEvent) => {
//     e.preventDefault();
//     setDragActive(false);
//     const f = e.dataTransfer.files?.[0] ?? null;
//     handleFiles(f);
//   };
//   const onDragOver = (e: React.DragEvent) => {
//     e.preventDefault();
//     e.dataTransfer.dropEffect = "copy";
//     setDragActive(true);
//   };
//   const onDragLeave = (e: React.DragEvent) => {
//     e.preventDefault();
//     setDragActive(false);
//   };

//   const modelObj = (car as any).model ?? (car as any).models ?? undefined;

//   return (
//     <div
//       className={`fixed inset-0 z-60 pointer-events-none transition-all ${
//         open ? "opacity-100" : "opacity-0"
//       }`}
//       aria-hidden={!open}
//     >
//       <div
//         onClick={onClose}
//         className={`absolute inset-0 bg-black/40 transition-opacity ${
//           open ? "opacity-100 pointer-events-auto" : "opacity-0"
//         }`}
//       />

//       <aside
//         className={`pointer-events-auto fixed right-0 top-0 h-full w-full sm:w-[920px] bg-white shadow-2xl transform transition-transform ${
//           open ? "translate-x-0" : "translate-x-full"
//         }`}
//         role="dialog"
//         aria-modal="true"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div
//           ref={panelRef}
//           onKeyDown={onKeyDown}
//           className="p-4 sm:p-6 h-full flex flex-col overflow-auto md:overflow-hidden"
//         >
//           <div className="flex items-center justify-between mb-3">
//             <div>
//               <div className="text-lg font-semibold">Confirm booking</div>
//               <div className="text-sm text-neutral-500">
//                 {modelObj?.brands?.name ?? ""} {modelObj?.name ?? ""}{" "}
//                 {car.year ?? ""}
//               </div>
//             </div>
//             <div className="flex items-center gap-2">
//               <button
//                 onClick={onClose}
//                 className="text-sm text-neutral-600 px-3 py-2 rounded-md hover:bg-neutral-100"
//                 disabled={submitting}
//               >
//                 Close
//               </button>
//             </div>
//           </div>

//           {/* layout */}
//           <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 h-full">
//             {/* LEFT: sticky summary with framer-motion animation */}
//             <AnimatePresence initial={false}>
//               {open && (
//                 <motion.div
//                   key="booking-summary"
//                   initial={{ opacity: 0, x: -56, scale: 0.995 }}
//                   animate={{ opacity: 1, x: 0, scale: 1 }}
//                   exit={{ opacity: 0, x: -10, scale: 0.995 }}
//                   transition={
//                     shouldReduceMotion
//                       ? { duration: 0 }
//                       : { duration: 0.55, ease: [0.22, 1, 0.36, 1] } // мягкая easeOut
//                   }
//                   layout
//                   whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
//                   className="relative md:flex-none md:w-[360px]"
//                 >
//                   <div className="md:sticky md:top-0 md:space-y-4 md:max-h-[calc(100vh-6rem)]">
//                     <div className="relative rounded-2xl overflow-hidden bg-white border border-gray-100 ring-1 ring-black/5 isolate">
//                       <div className="aspect-16/10 bg-gray-50">
//                         <img
//                           src={hero}
//                           alt={modelObj?.name ?? "car"}
//                           className="h-full w-full object-cover"
//                         />
//                       </div>

//                       <div className="p-4">
//                         <div className="flex items-start justify-between gap-3">
//                           <div>
//                             <div className="text-sm text-neutral-500">From</div>
//                             <div className="text-2xl font-semibold">
//                               {modelObj?.brands?.name ?? ""}{" "}
//                               {modelObj?.name ?? ""}
//                             </div>
//                           </div>
//                           <div className="text-right">
//                             <div className="text-xs text-neutral-500">
//                               Per day
//                             </div>
//                             <div className="text-2xl font-bold">
//                               {(car.price || 0).toFixed(0)}€
//                             </div>
//                           </div>
//                         </div>

//                         <div className="mt-3 text-sm text-neutral-600">
//                           <div>
//                             <strong>Pick-up:</strong>{" "}
//                             {start ? new Date(start).toLocaleString() : "—"}
//                           </div>
//                           <div>
//                             <strong>Return:</strong>{" "}
//                             {end ? new Date(end).toLocaleString() : "—"}
//                           </div>
//                         </div>

//                         <div className="mt-4 border-t pt-3">
//                           <div className="flex items-center justify-between text-sm">
//                             <div>
//                               Base ({days} {declineDays(days)})
//                             </div>
//                             <div>{baseTotal.toFixed(0)}€</div>
//                           </div>
//                           <div className="mt-2 flex items-center justify-between text-sm">
//                             <div>Options</div>
//                             <div>{optionsTotal.toFixed(0)}€</div>
//                           </div>

//                           {delivery && deliveryAddress.trim() ? (
//                             <div className="mt-3 text-sm text-neutral-600">
//                               <div className="mt-2">
//                                 <strong>Delivery to:</strong>
//                               </div>
//                               <div className="mt-1 text-sm text-neutral-800">
//                                 {deliveryAddress}
//                               </div>
//                             </div>
//                           ) : null}

//                           <div className="mt-3 border-t pt-3">
//                             <div className="flex items-center justify-between">
//                               <div className="text-sm text-neutral-500">
//                                 Total
//                               </div>
//                               <div className="text-xl font-semibold">
//                                 {grandTotal.toFixed(0)}€
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="text-center text-xs text-neutral-500">
//                       Need help? Call us 24/7 at{" "}
//                       <strong>+44 20 1234 5678</strong>
//                     </div>
//                   </div>
//                 </motion.div>
//               )}
//             </AnimatePresence>

//             {/* RIGHT: form (scrollable) */}
//             <div className="flex-1">
//               <div className="h-full pb-32 pr-2 md:overflow-y-scroll">
//                 {/* pb to avoid mobile sticky */}
//                 <div className="space-y-4">
//                   {/* Options card */}
//                   {/* Options card — motion switches */}
//                   <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 ring-1 ring-black/5 p-4">
//                     <div className="text-xs text-neutral-500">Options</div>
//                     <div className="mt-3 grid grid-cols-1 gap-3">
//                       {/** -- reusable switch renderer -- */}
//                       {[
//                         {
//                           key: "wash",
//                           label: "Exterior wash",
//                           desc: "Quick wash before pickup",
//                           price: OPTION_PRICES.wash,
//                           checked: wash,
//                           onToggle: () => setWash((s) => !s),
//                         },
//                         {
//                           key: "unlimited",
//                           label: "Unlimited mileage",
//                           desc: "Per day charge",
//                           price: `${OPTION_PRICES.unlimited}€/day`,
//                           checked: unlimited,
//                           onToggle: () => setUnlimited((s) => !s),
//                         },
//                         {
//                           key: "delivery",
//                           label: "Delivery",
//                           desc: "Delivery to your address",
//                           price: OPTION_PRICES.delivery,
//                           checked: delivery,
//                           onToggle: () => setDelivery((s) => !s),
//                         },
//                       ].map(
//                         ({ key, label, desc, price, checked, onToggle }) => (
//                           <div
//                             key={key}
//                             className="flex items-center justify-between"
//                           >
//                             <div>
//                               <div className="font-medium">{label}</div>
//                               <div className="text-xs text-neutral-500">
//                                 {desc}
//                               </div>
//                             </div>

//                             <div className="flex items-center gap-3">
//                               <div className="text-sm">{price}</div>

//                               <button
//                                 type="button"
//                                 role="switch"
//                                 aria-checked={checked}
//                                 tabIndex={0}
//                                 onClick={onToggle}
//                                 onKeyDown={(e) => {
//                                   if (e.key === "Enter" || e.key === " ") {
//                                     e.preventDefault();
//                                     onToggle();
//                                   }
//                                 }}
//                                 className="relative inline-flex h-6 w-10 items-center rounded-full focus:outline-none"
//                               >
//                                 {/* background (animated via style) */}
//                                 <motion.span
//                                   aria-hidden
//                                   className="absolute inset-0 rounded-full"
//                                   initial={false}
//                                   animate={{
//                                     backgroundColor: checked
//                                       ? "#000000"
//                                       : "#e5e7eb",
//                                   }}
//                                   transition={{
//                                     type: "spring",
//                                     stiffness: 400,
//                                     damping: 30,
//                                   }}
//                                   style={{ pointerEvents: "none" }}
//                                 />

//                                 {/* knob */}
//                                 <motion.span
//                                   className="relative inline-block h-4 w-4 ml-1 rounded-full bg-white shadow"
//                                   initial={false}
//                                   animate={{ x: checked ? 16 : 0 }}
//                                   transition={{
//                                     type: "spring",
//                                     stiffness: 500,
//                                     damping: 28,
//                                   }}
//                                 />
//                               </button>
//                             </div>
//                           </div>
//                         )
//                       )}

//                       {/* delivery address unchanged */}
//                       {delivery && (
//                         <div className="mt-2">
//                           <input
//                             value={deliveryAddress}
//                             onChange={(e) => setDeliveryAddress(e.target.value)}
//                             placeholder="Delivery address *"
//                             className={`w-full rounded-md border px-3 py-2 ${
//                               errors.deliveryAddress
//                                 ? "ring-1 ring-red-400"
//                                 : ""
//                             }`}
//                           />
//                           {errors.deliveryAddress && (
//                             <div className="text-xs text-red-500 mt-1">
//                               {errors.deliveryAddress}
//                             </div>
//                           )}
//                         </div>
//                       )}
//                     </div>
//                   </div>

//                   {/* Driver card */}
//                   <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 ring-1 ring-black/5 p-4">
//                     <div className="text-xs text-neutral-500">Driver</div>
//                     <div className="mt-3 grid grid-cols-1 gap-3">
//                       <input
//                         ref={firstFocusRef}
//                         value={driverName}
//                         onChange={(e) => setDriverName(e.target.value)}
//                         placeholder="Full name *"
//                         aria-required
//                         aria-invalid={!!errors.driverName}
//                         className={`w-full rounded-md border px-3 py-2 transition-shadow focus:shadow-md ${
//                           errors.driverName ? "ring-1 ring-red-400" : ""
//                         }`}
//                       />
//                       {errors.driverName && (
//                         <div className="text-xs text-red-500">
//                           {errors.driverName}
//                         </div>
//                       )}

//                       <div className="grid grid-cols-2 gap-2">
//                         <div>
//                           <label className="text-xs text-neutral-500">
//                             Date of birth (DOB)
//                           </label>
//                           <input
//                             type="date"
//                             value={driverDob ?? ""}
//                             onChange={(e) =>
//                               setDriverDob(e.target.value || null)
//                             }
//                             aria-label="Date of birth"
//                             className="w-full rounded-md border px-3 py-2"
//                           />
//                         </div>
//                         <div>
//                           <label className="text-xs text-neutral-500">
//                             License expiry date
//                           </label>
//                           <input
//                             type="date"
//                             value={driverLicenseExpiry ?? ""}
//                             onChange={(e) =>
//                               setDriverLicenseExpiry(e.target.value || null)
//                             }
//                             aria-label="License expiry date"
//                             className="w-full rounded-md border px-3 py-2"
//                           />
//                         </div>
//                       </div>

//                       <input
//                         value={driverLicense}
//                         onChange={(e) => setDriverLicense(e.target.value)}
//                         placeholder="Driver license number *"
//                         aria-required
//                         aria-invalid={!!errors.driverLicense}
//                         className={`w-full rounded-md border px-3 py-2 ${
//                           errors.driverLicense ? "ring-1 ring-red-400" : ""
//                         }`}
//                       />
//                       {errors.driverLicense && (
//                         <div className="text-xs text-red-500">
//                           {errors.driverLicense}
//                         </div>
//                       )}

//                       <div className="grid grid-cols-2 gap-2">
//                         <input
//                           value={driverPhone}
//                           onChange={(e) => setDriverPhone(e.target.value)}
//                           placeholder="Phone *"
//                           aria-required
//                           aria-invalid={!!errors.driverPhone}
//                           className={`w-full rounded-md border px-3 py-2 ${
//                             errors.driverPhone ? "ring-1 ring-red-400" : ""
//                           }`}
//                         />
//                         <input
//                           value={driverEmail}
//                           onChange={(e) => {
//                             setDriverEmail(e.target.value);
//                             if (errors.driverEmail)
//                               setErrors((p) => {
//                                 const n = { ...p };
//                                 delete n.driverEmail;
//                                 return n;
//                               });
//                           }}
//                           placeholder="Email *"
//                           type="email"
//                           aria-required
//                           aria-invalid={!!errors.driverEmail}
//                           className={`w-full rounded-md border px-3 py-2 ${
//                             errors.driverEmail ? "ring-1 ring-red-400" : ""
//                           }`}
//                         />
//                       </div>
//                       {errors.driverEmail && (
//                         <div className="text-xs text-red-500">
//                           {errors.driverEmail}
//                         </div>
//                       )}

//                       {/* drag & drop upload */}
//                       <div>
//                         <label className="text-xs text-neutral-500">
//                           Upload driver license (photo)
//                         </label>

//                         <div
//                           onDrop={onDrop}
//                           onDragOver={onDragOver}
//                           onDragLeave={onDragLeave}
//                           className={`mt-2 flex items-center gap-3 rounded-md border-dashed ${
//                             dragActive ? "border-black" : "border-gray-200"
//                           } border p-3 bg-white`}
//                         >
//                           <div className="flex-1">
//                             <div className="text-sm text-neutral-700">
//                               {licensePreview ? (
//                                 <div className="flex items-center gap-3">
//                                   <img
//                                     src={licensePreview}
//                                     alt="preview"
//                                     className="h-12 w-16 object-cover rounded-md"
//                                   />
//                                   <div>
//                                     <div className="font-medium">
//                                       {licenseFile?.name}
//                                     </div>
//                                     <div className="text-xs text-neutral-500">
//                                       {licenseFile?.size
//                                         ? Math.round(licenseFile.size / 1024)
//                                         : ""}{" "}
//                                       KB
//                                     </div>
//                                   </div>
//                                 </div>
//                               ) : (
//                                 <div className="text-sm text-neutral-500">
//                                   Drag & drop file here, or{" "}
//                                   <label className="underline cursor-pointer">
//                                     <input
//                                       type="file"
//                                       className="hidden"
//                                       onChange={(e) =>
//                                         handleFiles(e.target.files?.[0] ?? null)
//                                       }
//                                     />
//                                     select file
//                                   </label>
//                                 </div>
//                               )}
//                             </div>

//                             {uploadProgress != null && (
//                               <div
//                                 role="status"
//                                 aria-live="polite"
//                                 className="mb-2 mt-2"
//                               >
//                                 <div className="text-xs text-neutral-500">
//                                   Upload: {uploadProgress}%
//                                 </div>
//                                 <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
//                                   <div
//                                     style={{ width: `${uploadProgress}%` }}
//                                     className="h-2 rounded-full bg-black"
//                                   />
//                                 </div>
//                               </div>
//                             )}

//                             {uploadedUrl && (
//                               <div className="text-xs text-neutral-500 mt-2">
//                                 Uploaded: {uploadedUrl}
//                               </div>
//                             )}
//                             {errors.driverLicenseFile && (
//                               <div className="text-xs text-red-500 mt-2">
//                                 {errors.driverLicenseFile}
//                               </div>
//                             )}
//                           </div>

//                           {licensePreview && (
//                             <button
//                               type="button"
//                               onClick={() => {
//                                 setLicenseFile(null);
//                                 setLicensePreview(null);
//                                 setUploadProgress(null);
//                                 setUploadedUrl(null);
//                               }}
//                               className="text-xs text-red-500 px-2 py-1 rounded-md hover:bg-red-50"
//                             >
//                               Remove
//                             </button>
//                           )}
//                         </div>
//                       </div>
//                     </div>
//                   </div>

//                   {/* terms */}
//                   <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 ring-1 ring-black/5 p-4">
//                     <label className="flex items-start gap-3">
//                       <input
//                         id="terms"
//                         type="checkbox"
//                         checked={acceptedTerms}
//                         onChange={(e) => {
//                           setAcceptedTerms(e.target.checked);
//                           if (e.target.checked)
//                             setAcceptedTs(new Date().toISOString());
//                           else setAcceptedTs(null);
//                         }}
//                       />
//                       <div className="text-sm">
//                         I agree to the{" "}
//                         <a
//                           href="/rental-terms.pdf"
//                           target="_blank"
//                           rel="noreferrer"
//                           className="underline"
//                         >
//                           Terms & Conditions
//                         </a>{" "}
//                         and{" "}
//                         <a
//                           href="/privacy"
//                           target="_blank"
//                           rel="noreferrer"
//                           className="underline"
//                         >
//                           Privacy Policy
//                         </a>
//                         .
//                         {errors.acceptedTerms && (
//                           <div className="text-xs text-red-500">
//                             {errors.acceptedTerms}
//                           </div>
//                         )}
//                       </div>
//                     </label>
//                   </div>

//                   {/* desktop action row - only button (no duplicate total) */}
//                   <div className="hidden sm:flex items-center justify-center gap-3">
//                     <button
//                       ref={lastFocusRef}
//                       onClick={handleConfirm}
//                       disabled={!canSubmit || submitting}
//                       className={`rounded-xl py-3 px-5 font-medium transition-all flex items-center justify-center gap-3 w-full ${
//                         !canSubmit || submitting
//                           ? "bg-gray-100 text-gray-800 cursor-not-allowed"
//                           : "bg-black text-white"
//                       }`}
//                     >
//                       {submitting ? (
//                         <>
//                           <svg
//                             className="h-4 w-4 animate-spin"
//                             xmlns="http://www.w3.org/2000/svg"
//                             fill="none"
//                             viewBox="0 0 24 24"
//                           >
//                             <circle
//                               className="opacity-25"
//                               cx="12"
//                               cy="12"
//                               r="10"
//                               stroke="currentColor"
//                               strokeWidth="4"
//                             />
//                             <path
//                               className="opacity-75"
//                               fill="currentColor"
//                               d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
//                             />
//                           </svg>
//                           <span>Booking…</span>
//                         </>
//                       ) : (
//                         <>Book — {grandTotal.toFixed(0)}€</>
//                       )}
//                     </button>
//                   </div>

//                   {!canSubmit && !submitting && (
//                     <div className="mt-2 text-center text-xs text-red-500">
//                       Please fill required fields and accept Terms. If you
//                       uploaded license — wait until upload finishes.
//                     </div>
//                   )}
//                   {errors.submit && (
//                     <div className="mt-2 text-center text-xs text-red-500">
//                       {errors.submit}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* MOBILE sticky bar */}
//           <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50 border-gray-100 bg-white border-t p-3">
//             <div className="mx-auto max-w-3xl flex items-center justify-between gap-3 font-roboto-condensed">
//               <div>
//                 <div className="text-xs text-neutral-500">Total</div>
//                 <div className="text-xl font-semibold">
//                   {grandTotal.toFixed(0)}€
//                 </div>
//               </div>
//               <button
//                 onClick={handleConfirm}
//                 disabled={!canSubmit || submitting}
//                 className={`ml-2 rounded-xl py-2 px-4 font-medium transition-all flex items-center gap-2 ${
//                   !canSubmit || submitting
//                     ? "bg-gray-100 text-gray-800 cursor-not-allowed"
//                     : "bg-black text-white"
//                 }`}
//               >
//                 {submitting ? (
//                   <>
//                     <svg
//                       className="h-4 w-4 animate-spin"
//                       xmlns="http://www.w3.org/2000/svg"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                     >
//                       <circle
//                         className="opacity-25"
//                         cx="12"
//                         cy="12"
//                         r="10"
//                         stroke="currentColor"
//                         strokeWidth="4"
//                       />
//                       <path
//                         className="opacity-75"
//                         fill="currentColor"
//                         d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
//                       />
//                     </svg>
//                     <span>Booking…</span>
//                   </>
//                 ) : (
//                   <>Book</>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       </aside>
//     </div>
//   );
// }
