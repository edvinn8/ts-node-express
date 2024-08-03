import { firestore } from 'firebase-admin';

export interface Chat {
  users:           ChatUser[];
  messages:        Message[];
  threads:         Thread[];
  deletedMessages?: number[];
  currentUser?: ChatUserConfig;
  currentTime:     number;
  lastUpdate: string;
  totalMessages: number;
  participantsCount: number;
  lastMessageId: number;
  lastReadMessageId: number;
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
  meta:       MetaMeta;
  replyTo?:   Message;
  favorited:  number;
  hasFiles:   boolean;
}

export interface MetaMeta {
  reactions?: ReactionMeta[];
  replyTo?:   number;
  files: File[];
}

export interface File {
  id:       number;
  thumb:    string;
  url:      string;
  mimeType: string;
  name:     string;
  size:     number;
  ext:      string;
}

export interface ReactionMeta {
  reaction: Reaction;
  users: number[];
}

export enum Reaction {
  Ok = '1f44c',
  Like = '1f44d',
  InLove = '1f60d',
  Surprised = '1f632',
  Thinking = '1f914',
  Star = '2b50',
}

export const ReactionEmojiMap = {
  [Reaction.Ok]: '👌',
  [Reaction.Like]: '👍',
  [Reaction.InLove]: '😍',
  [Reaction.Surprised]: '😲',
  [Reaction.Thinking]: '🤔',
  [Reaction.Star]: '⭐',
};

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

export interface ChatUserConfig extends ChatUser {
  wpNonce: string;
  wpCookie: string;
  updatedAt: any;
}

export interface ChatConfig {
  wpNonce: string;
  wpCookie: string;
  updatedAt: firestore.Timestamp;
  user_id: number;
}

export interface ReactionUpdate {
  emoji: Reaction;
  message_id: number;
}
