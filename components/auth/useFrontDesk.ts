"use client";

import { useEffect, useState } from "react";
import { isFrontDesk } from "@/lib/data/operations-role";
import { createClient } from "@/lib/supabase/client";

export function useFrontDesk() {
  const [frontDesk, setFrontDesk] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    void createClient().auth.getUser().then(({ data }) => {
      if (current) setFrontDesk(isFrontDesk(data.user));
    }).catch(() => { if (current) setFrontDesk(false); });
    return () => { current = false; };
  }, []);
  return frontDesk;
}
