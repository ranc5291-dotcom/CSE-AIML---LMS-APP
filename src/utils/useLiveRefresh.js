import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

// Subscribes to Supabase realtime changes on the given tables.
// Returns a number that increases whenever any of them changes,
// so pages can add it to a useEffect dependency list to reload data.
export function useLiveRefresh(tables = []) {
  const [tick, setTick] = useState(0);
  const timer = useRef(null);
  const key = tables.join(",");

  useEffect(() => {
    if (!key) return undefined;
    const bump = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setTick((n) => n + 1), 400);
    };

    const channel = supabase.channel(`live-${key}-${Math.random().toString(36).slice(2)}`);
    key.split(",").forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    });
    channel.subscribe();

    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [key]);

  return tick;
}
