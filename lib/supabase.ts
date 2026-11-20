import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Адрес страницы в момент загрузки. Supabase убирает токены из адресной строки сразу после входа
// по ссылке из письма, поэтому тип ссылки (например, сброс пароля) нужно запомнить заранее.
export const INITIAL_URL_HASH =
  Platform.OS === "web" && typeof window !== "undefined" ? window.location.hash : "";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          // На вебе magic link возвращает токены в адресной строке, их нужно подхватить.
          // На телефоне ссылок такого вида нет.
          detectSessionInUrl: Platform.OS === "web",
          lock: processLock,
        },
      })
    : null;
