"use client";

import { useEffect, useState } from "react";

import { TabletBannerViewer, type TabletBannerSlide } from "@/components/tablet/TabletBannerViewer";
import type { ApiResponse } from "@/lib/api-types";

export default function TabletBannersFullscreenPage() {
  const [banners, setBanners] = useState<TabletBannerSlide[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tablet/banners");
        const json = (await res.json()) as ApiResponse<{ items: TabletBannerSlide[] }>;
        if (res.ok && json?.ok) {
          setBanners(json.data.items ?? []);
        } else {
          setBanners([]);
        }
      } catch {
        setBanners([]);
      }
    }
    void load();
  }, []);

  return <TabletBannerViewer mode="fullscreen" banners={banners} />;
}
