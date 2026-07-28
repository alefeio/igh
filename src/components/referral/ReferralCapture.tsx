"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { persistReferralCode } from "@/lib/referral-client";

/**
 * Captura ?ref= na URL e grava em cookie + localStorage,
 * para o vínculo sobreviver se a pessoa navegar antes de se cadastrar.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) persistReferralCode(ref);
  }, [searchParams]);

  return null;
}
