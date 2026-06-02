export type IghCommunityTopicKind = "IDEA" | "TEAM" | "DISCUSSION";
export type IghCommunityPostStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CommunityTopicView = {
  id: string;
  kind: IghCommunityTopicKind;
  kindLabel: string;
  title: string;
  content: string;
  status: IghCommunityPostStatus;
  statusLabel: string;
  authorName: string;
  authorStudentId: string;
  isOwn: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
};
