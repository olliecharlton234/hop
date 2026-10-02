/* Outing chat: one small group chat per outing (no DMs). V6 is local with a simulator
   standing in for friends' phones; V7 subscribes to a Supabase Realtime channel per outing. */
import * as R from '@/data/demo/repository';
export const chatService = {
  messages: R.messagesOf,
  message: R.messageById,
  canChat: R.canChat,
  phase: R.chatPhase,
  closesAt: R.chatClosesAt,
  post: R.postMessage,
  react: R.react,
  keen: R.keen,
  vote: R.vote,
  closePoll: R.closePoll,
  stopSharing: R.stopSharing,
  markRead: R.markRead,
  lastRead: R.lastRead,
  unread: R.unread,
  lastMessage: R.lastMessage,
  pref: R.chatPref,
  setPref: R.setChatPref,
  mentionsMe: R.mentionsMe,
};
