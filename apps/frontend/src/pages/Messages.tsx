import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Sparkles, Search, MessageCircle, Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getThread, listContacts, sendMessage, type Message as Msg, type Contact } from '../services/messages';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

type ContactView = Contact & { unreadCount: number };

const accentPalette = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-lime-500',
  'bg-cyan-500',
  'bg-green-500',
  'bg-emerald-600',
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAccent(id: string) {
  const index = hashString(id) % accentPalette.length;
  return accentPalette[index];
}

function initials(value?: string) {
  if (!value) return '👤';
  const parts = value.split('@')[0]?.split(/[.\s_-]+/) ?? [];
  const [first = '', second = ''] = parts;
  const chars = `${first.charAt(0)}${second.charAt(0)}`.trim();
  return chars || value.charAt(0).toUpperCase();
}

function formatRelativeTime(date?: string) {
  if (!date) return 'Sin actividad reciente';
  const now = Date.now();
  const target = new Date(date).getTime();
  const diffMs = now - target;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Hace instantes';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return new Date(date).toLocaleDateString();
}

function formatMessageTime(date: string) {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(new Date(date));
}

function MessagesHero({ pending }: { pending: number }) {
  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-[1px] shadow-xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative h-full w-full rounded-[29px] bg-white/85 px-6 py-7 backdrop-blur">
        <div className="absolute -top-10 -right-16 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-14 left-10 h-40 w-40 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 text-emerald-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold md:text-3xl">Mensajería en tiempo real</h1>
              <p className="text-sm text-emerald-700/80">
                Conversa con tu equipo tal como si estuvieras en WhatsApp, pero integrado a tu operación diaria.
              </p>
            </div>
          </div>
          <motion.div
            className="flex items-center gap-3 rounded-2xl bg-emerald-50/80 px-4 py-3 text-emerald-700 shadow-inner"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <MessageCircle className="h-5 w-5" />
            <div className="text-sm">
              <p className="font-semibold">{pending > 0 ? `${pending} mensajes pendientes` : 'Todo al día'}</p>
              <p className="text-xs text-emerald-600/80">
                {pending > 0 ? 'Abre las conversaciones para ponerte al corriente.' : 'No tienes mensajes pendientes.'}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default function MessagesPage() {
  return <MessagesPane />;
}

function MessagesPane() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [contacts, setContacts] = useState<ContactView[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastPendingRef = useRef<number>(0);

  const scrollToBottom = useCallback((smooth = true) => {
    window.setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight + 160, behavior: smooth ? 'smooth' : 'auto' });
    }, smooth ? 80 : 0);
  }, []);

  const normalizeContacts = useCallback((data: Contact[]) => {
    return data.map((c) => ({ ...c, unreadCount: c.unreadCount ?? 0 }));
  }, []);

  const fetchContacts = useCallback(async () => {
    const data = await listContacts();
    const normalized = normalizeContacts(data);
    setContacts(normalized);
    return normalized;
  }, [normalizeContacts]);

  useEffect(() => {
    fetchContacts()
      .then((list) => {
        if (list.length === 0) return;
        const priority = list.find((c) => c.unreadCount > 0) ?? list[0];
        setSelected((current) => current || priority.id);
      })
      .catch(() => toast.error('No se pudieron cargar los contactos.'));
  }, [fetchContacts]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    let active = true;
    setLoadingThread(true);
    getThread(selected)
      .then((thread) => {
        if (!active) return;
        setMessages(thread);
        setContacts((prev) => prev.map((c) => (c.id === selected ? { ...c, unreadCount: 0 } : c)));
        scrollToBottom(false);
      })
      .catch(() => toast.error('No se pudo cargar la conversación.'))
      .finally(() => {
        if (!active) return;
        setLoadingThread(false);
      });
    return () => {
      active = false;
    };
  }, [selected, scrollToBottom]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (incoming: Msg) => {
      setContacts((prev) => prev.map((c) => {
        if (c.id === incoming.sender.id && incoming.recipient.id === user?.sub && incoming.sender.id !== selected) {
          return { ...c, unreadCount: c.unreadCount + 1, lastAt: incoming.createdAt };
        }
        if (c.id === incoming.recipient.id && incoming.sender.id === user?.sub) {
          return { ...c, lastAt: incoming.createdAt };
        }
        if (c.id === incoming.sender.id || c.id === incoming.recipient.id) {
          return { ...c, lastAt: incoming.createdAt };
        }
        return c;
      }));

      if (incoming.sender.id === selected || incoming.recipient.id === selected) {
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        scrollToBottom();
      } else if (incoming.recipient.id === user?.sub) {
        const label = contacts.find((c) => c.id === incoming.sender.id);
        toast(messagePreview(label ? label.name || label.email : incoming.sender.email, incoming.content));
      }

      fetchContacts().catch(() => {});
    };
    socket.on('message:created', onMessage);
    return () => {
      socket.off('message:created', onMessage);
    };
  }, [socket, selected, scrollToBottom, fetchContacts, contacts, user?.sub]);

  const pendingCount = useMemo(
    () => contacts.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0),
    [contacts],
  );

  useEffect(() => {
    if (pendingCount <= 0) {
      lastPendingRef.current = 0;
      return;
    }
    if (pendingCount !== lastPendingRef.current) {
      toast.info(`Tienes ${pendingCount} mensaje${pendingCount === 1 ? '' : 's'} por revisar.`);
      lastPendingRef.current = pendingCount;
    }
  }, [pendingCount]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? contacts.filter((c) =>
          [c.name, c.email]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(term)),
        )
      : [...contacts];
    return base.sort((a, b) => {
      const unreadDiff = (b.unreadCount ?? 0) - (a.unreadCount ?? 0);
      if (unreadDiff !== 0) return unreadDiff;
      const dateA = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const dateB = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [contacts, search]);

  useEffect(() => {
    if (!selected && filteredContacts[0]) {
      setSelected(filteredContacts[0].id);
    }
  }, [filteredContacts, selected]);

  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [text]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !text.trim() || isSending) return;
    setIsSending(true);
    try {
      const sent = await sendMessage(selected, text.trim());
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setText('');
      scrollToBottom();
      fetchContacts().catch(() => {});
    } catch (err) {
      toast.error('No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend(event as unknown as React.FormEvent);
    }
  };

  const currentContact = useMemo(() => contacts.find((c) => c.id === selected), [contacts, selected]);

  return (
    <div className="space-y-8">
      <MessagesHero pending={pendingCount} />
  <div className="grid grid-cols-12 gap-6 md:h-[calc(100vh-260px)] md:min-h-[520px] md:items-stretch lg:gap-8">
        <motion.aside
          layout
          className="col-span-12 overflow-hidden rounded-3xl border border-emerald-100/60 bg-white/90 shadow-lg shadow-emerald-500/5 backdrop-blur md:col-span-4 md:flex md:h-full md:min-h-0 md:flex-col"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-500">Conversaciones</p>
              <h2 className="text-xl font-semibold text-emerald-950">Tu equipo conectado</h2>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
              <Search className="h-4 w-4 text-emerald-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Busca por nombre o correo"
                className="w-full bg-transparent text-sm text-emerald-900 placeholder:text-emerald-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4 md:min-h-0">
            <div className="space-y-2">
              {filteredContacts.map((contact) => {
                const active = contact.id === selected;
                const accent = getAccent(contact.id);
                return (
                  <motion.button
                    key={contact.id}
                    layout
                    onClick={() => setSelected(contact.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      active
                        ? 'bg-emerald-500/10 shadow-inner shadow-emerald-500/20'
                        : 'hover:-translate-y-[1px] hover:bg-emerald-50/80'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow ${accent}`}>
                      <span className="text-sm font-semibold">{initials(contact.name || contact.email)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-emerald-900 line-clamp-1">{contact.name || contact.email}</p>
                        <span className="text-[11px] text-emerald-500/80">{formatRelativeTime(contact.lastAt)}</span>
                      </div>
                      <p className="text-xs text-emerald-500/70 line-clamp-1">{contact.email}</p>
                    </div>
                    {contact.unreadCount > 0 && (
                      <motion.span
                        className="inline-flex min-w-[26px] items-center justify-center rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white shadow"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        {contact.unreadCount}
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
              {filteredContacts.length === 0 && (
                <div className="mx-4 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-center text-sm text-emerald-600">
                  No encontramos coincidencias. Revisa tu búsqueda o inicia nuevas conversaciones desde otros módulos.
                </div>
              )}
            </div>
          </div>
        </motion.aside>

        <motion.section
          layout
          className="relative col-span-12 flex flex-col overflow-hidden rounded-3xl border border-emerald-100/60 bg-white/90 shadow-2xl shadow-emerald-500/10 backdrop-blur md:col-span-8 md:h-full md:min-h-0"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="relative flex shrink-0 items-center justify-between border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-500">Conversando con</p>
              <h3 className="text-lg font-semibold text-emerald-950">{currentContact ? currentContact.name || currentContact.email : 'Selecciona un contacto'}</h3>
              {currentContact && (
                <p className="text-xs text-emerald-500/80">{currentContact.email}</p>
              )}
            </div>
            {currentContact && (
              <div className="flex items-center gap-3 text-xs text-emerald-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Activo • {formatRelativeTime(currentContact.lastAt)}
                </span>
              </div>
            )}
          </div>

          <div className="relative flex-1 overflow-hidden min-h-0">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-lime-50" />
            <div className="pointer-events-none absolute -bottom-10 left-16 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -top-16 right-12 h-52 w-52 rounded-full bg-teal-200/40 blur-3xl" />
            <div ref={scroller} className="relative z-10 flex h-full flex-1 flex-col gap-3 overflow-y-auto px-6 py-6 custom-scrollbar md:min-h-0">
              {loadingThread && (
                <div className="flex h-full w-full items-center justify-center text-emerald-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              )}
              {!loadingThread && messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-emerald-500/80">
                  <MessageCircle className="h-12 w-12" />
                  <p className="text-sm">Aún no hay mensajes en esta conversación. ¡Escribe el primero!</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  const isOwn = message.sender.id === user?.sub;
                  return (
                    <motion.div
                      key={message.id}
                      className={`flex w-full ${isOwn ? 'justify-end pl-10' : 'justify-start pr-10'}`}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    >
                      <div
                        className={`max-w-[80%] rounded-3xl px-5 py-3 text-sm shadow-lg ${
                          isOwn
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30'
                            : 'bg-white/90 text-emerald-950 backdrop-blur-sm shadow-emerald-500/10'
                        }`}
                      >
                        {message.content && (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {message.content}
                          </p>
                        )}
                        <div className={`mt-2 text-[11px] font-medium ${isOwn ? 'text-emerald-50/80' : 'text-emerald-500/70'} text-right`}>
                          {formatMessageTime(message.createdAt)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative shrink-0 border-t border-emerald-100/70 bg-white/90 px-6 py-4">
            <form onSubmit={handleSend} className="flex items-end gap-3">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-500 shadow transition hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-emerald-50"
                title="Próximamente"
                disabled
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex-1 rounded-3xl border border-emerald-100 bg-emerald-50/40 px-4 py-2 shadow-inner shadow-emerald-500/10">
                <textarea
                  ref={composerRef}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Escribe un mensaje increíble..."
                  rows={1}
                  className="w-full max-h-40 resize-none bg-transparent text-sm text-emerald-900 placeholder:text-emerald-400 focus:outline-none"
                />
              </div>
              <motion.button
                type="submit"
                disabled={!text.trim() || isSending || !selected}
                className="flex h-12 min-w-[3rem] items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition disabled:cursor-not-allowed disabled:opacity-60"
                whileTap={{ scale: 0.94 }}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
              </motion.button>
            </form>
            <p className="mt-2 text-right text-[11px] text-emerald-500/70">
              Presiona Enter para enviar • Shift + Enter para saltar de línea
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function messagePreview(author: string, content?: string) {
  const snippet = content ? content.slice(0, 80) : 'Nuevo mensaje';
  return `${author}: ${snippet}`;
}