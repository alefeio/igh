export type IghCommunityTopicKind = "IDEA" | "TEAM" | "DISCUSSION";
export type IghCommunityPostStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CommunityViewer = {
  id: string;
  name: string;
  role: string;
};

export type CommunityViewerCapabilities = {
  canCreateTopics: boolean;
  canReply: boolean;
  canModerate: boolean;
  isStudent: boolean;
  isTeacher: boolean;
  isStaff: boolean;
};

export type CommunityAuthorRole = "STUDENT" | "TEACHER" | "STAFF";

export type CommunityTopicView = {
  id: string;
  kind: IghCommunityTopicKind;
  kindLabel: string;
  title: string;
  content: string;
  status: IghCommunityPostStatus;
  statusLabel: string;
  authorName: string;
  authorUserId: string;
  authorRole: CommunityAuthorRole;
  authorRoleLabel: string;
  authorStudentId: string | null;
  isOwn: boolean;
  replyCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CommunityReplyView = {
  id: string;
  content: string;
  status: IghCommunityPostStatus;
  statusLabel: string;
  authorName: string;
  authorUserId: string;
  authorRole: CommunityAuthorRole;
  authorRoleLabel: string;
  authorStudentId: string | null;
  isOwn: boolean;
  createdAt: string;
};
