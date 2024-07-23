import { firestore } from 'firebase-admin';

export interface Chat {
  users:           ChatUser[];
  messages:        Message[];
  threads:         Thread[];
  deletedMessages?: number[];
  currentTime:     number;
  lastUpdate: string;
  totalMessages: number;
  participantsCount: number;
}

export interface Message {
  thread_id:  number;
  sender_id:  number;
  sender?:    ChatUser;
  message:    string;
  date_sent:  string;
  created_at: number;
  updated_at: number;
  temp_id:    string;
  message_id: number;
  meta:       any[] | MetaMeta;
  favorited:  number;
}

export interface MetaMeta {
  reactions?: Reactions;
  replyTo?:   number;
}

export interface Reactions {
  "0": The0;
}

export interface The0 {
  reaction: string;
  users:    { [key: string]: number };
}

export enum Reaction {
  The1F44C = "1f44c",
  The1F44D = "1f44d",
  The1F60D = "1f60d",
  The1F914 = "1f914",
  The2B50 = "2b50",
}

export interface Thread {
  thread_id:         number;
  isHidden:          number;
  isDeleted:         number;
  type:              string;
  title:             string;
  subject:           string;
  image:             string;
  lastTime:          number;
  participants:      number[];
  participantsCount: number;
  moderators:        any[];
  url:               string;
  meta:              ThreadMeta;
  isPinned:          number;
  isMuted:           boolean;
  permissions:       Permissions;
  mentions:          any[];
  unread:            number;
  chatRoom:          ChatRoom;
}

export interface ChatRoom {
  id:                  number;
  template:            string;
  modernLayout:        string;
  onlyJoinedCanRead:   boolean;
  enableFiles:         boolean;
  guestAllowed:        boolean;
  mustJoinMessage:     string;
  joinButtonText:      string;
  notAllowedText:      string;
  notAllowedReplyText: string;
  mustLoginText:       string;
  loginButtonText:     string;
  guestButtonText:     string;
  autoJoin:            boolean;
  isJoined:            boolean;
  canJoin:             boolean;
  hideParticipants:    boolean;
}

export interface ThreadMeta {
  allowInvite: boolean;
}

export interface Permissions {
  isModerator:          boolean;
  deleteAllowed:        boolean;
  canDeleteOwnMessages: boolean;
  canDeleteAllMessages: boolean;
  canEditOwnMessages:   boolean;
  canFavorite:          boolean;
  canMuteThread:        boolean;
  canEraseThread:       boolean;
  canClearThread:       boolean;
  canInvite:            boolean;
  canLeave:             boolean;
  canUpload:            boolean;
  canVideoCall:         boolean;
  canAudioCall:         boolean;
  canMaximize:          boolean;
  canPinMessages:       boolean;
  canMinimize:          boolean;
  canReply:             boolean;
  canReplyMsg:          any[];
}

export interface ChatUser {
  id:         string;
  user_id:    number;
  name:       string;
  avatar:     string;
  url:        boolean;
  verified:   number;
  lastActive: string;
  isFriend:   number;
  canVideo:   number;
  canAudio:   number;
}

export interface ChatConfig {
  wpNonce: string;
  wpCookie: string;
  updatedAt: firestore.Timestamp;
}
