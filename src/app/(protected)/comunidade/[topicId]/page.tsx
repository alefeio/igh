"use client";

import { useParams } from "next/navigation";

import { IghCommunityTopicDetail } from "@/components/community/IghCommunityTopicDetail";

export default function ComunidadeTopicPage() {
  const params = useParams();
  const topicId = typeof params.topicId === "string" ? params.topicId : "";

  return (
    <div className="min-w-0 max-w-3xl">
      {topicId ? <IghCommunityTopicDetail topicId={topicId} /> : <p className="text-sm text-[var(--text-muted)]">Tópico inválido.</p>}
    </div>
  );
}
