import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://njolhcyjyblkqohbjayj.supabase.co";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_mK6GlrefF83FfdcFzGCXuQ_C1pvq-BG";

export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export function errorText(error: unknown, fallback = "Ocurrió un error") {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/duplicate key/i.test(message)) return "Ya existe un registro igual (por ejemplo, una categoría o caravana repetida).";
  if (/row-level security|permission denied/i.test(message)) return "Tu usuario no tiene permiso para hacer esto en este establecimiento.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Sin conexión. Revisá la señal e intentá de nuevo.";
  return message || fallback;
}
