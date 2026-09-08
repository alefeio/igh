import type { Metadata } from "next";

import { pageTitle } from "@/lib/brand";

import { HolidayEventCheckinClient } from "./HolidayEventCheckinClient";

export const metadata: Metadata = {
  title: pageTitle("Check-in do evento"),
};

export default async function HolidayEventCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { id } = await params;
  const { data } = await searchParams;
  const initialDate = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;

  return <HolidayEventCheckinClient holidayId={id} initialDate={initialDate} />;
}
