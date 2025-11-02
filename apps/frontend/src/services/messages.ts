import api from './api';

export interface Contact {
  id: string;
  email: string;
  name?: string;
  lastAt?: string;
  unreadCount?: number;
}
export interface Message {
  id: string;
  content?: string;
  imageUrl?: string;
  createdAt: string;
  sender: { id: string; email: string; name?: string };
  recipient: { id: string; email: string; name?: string };
}

export async function listContacts(){
  const { data } = await api.get<Contact[]>('/messages/contacts');
  return data;
}

export async function getThread(userId: string){
  const { data } = await api.get<Message[]>(`/messages/thread/${userId}`);
  return data;
}

export async function sendMessage(recipientId: string, content?: string){
  const { data } = await api.post<Message>('/messages/send', { recipientId, content });
  return data;
}
