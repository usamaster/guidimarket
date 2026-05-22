import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import type { Message } from '../lib/database.types'

interface ChatBoxProps {
  userId: string
  displayName: string
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function ChatBox({ userId, displayName }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [collapsedMobile, setCollapsedMobile] = useState(true)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const collapsedRef = useRef(collapsedMobile)

  useEffect(() => { collapsedRef.current = collapsedMobile }, [collapsedMobile])

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data as Message[])
      })

    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Message
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg].slice(-200)
        })
        if (collapsedRef.current && msg.user_id !== userId && window.innerWidth < 640) {
          setUnread(u => u + 1)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, collapsedMobile])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')
    await supabase.from('messages').insert({
      user_id: userId,
      display_name: displayName,
      content: text,
    } as Record<string, unknown>)
    setSending(false)
  }

  const toggleMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 640) return
    setCollapsedMobile(c => {
      const next = !c
      if (!next) setUnread(0)
      return next
    })
  }

  return (
    <div
      className={`fixed z-30 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-[height]
        right-4 sm:right-5
        bottom-16 sm:bottom-5
        w-[calc(100%-2rem)] sm:w-[340px]
        sm:h-[420px]
        ${collapsedMobile ? 'h-11' : 'h-[260px]'}`}
    >
      <button
        type="button"
        onClick={toggleMobile}
        className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg/40 shrink-0 cursor-pointer sm:cursor-default text-left w-full"
      >
        <span className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-dark">{t.chat.title}</h3>
          {collapsedMobile && unread > 0 && (
            <span className="sm:hidden inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-no text-white text-[10px] font-bold">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-yes font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yes animate-pulse" />
            live
          </span>
          <span className={`sm:hidden text-text-muted text-xs transition-transform ${collapsedMobile ? '' : 'rotate-180'}`}>▼</span>
        </span>
      </button>

      <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0 ${collapsedMobile ? 'hidden sm:block' : 'block'}`}>
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center mt-8">{t.chat.empty}</p>
        )}
        {messages.map((m, i) => {
          const isMe = m.user_id === userId
          const prev = messages[i - 1]
          const sameAuthor = prev && prev.user_id === m.user_id
            && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!sameAuthor && (
                <span className="text-[10px] text-text-muted mb-0.5 px-1">
                  {isMe ? t.chat.you : m.display_name} · {fmtTime(m.created_at)}
                </span>
              )}
              <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs break-words ${
                isMe
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-bg text-dark rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className={`gap-1.5 p-2 border-t border-border bg-bg/40 shrink-0 ${collapsedMobile ? 'hidden sm:flex' : 'flex'}`}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t.chat.placeholder}
          maxLength={500}
          className="flex-1 min-w-0 border border-border rounded-full px-3 py-1.5 text-xs bg-surface text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label={t.chat.send}
          className="w-8 h-8 shrink-0 rounded-full bg-primary hover:bg-primary-hover disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
    </div>
  )
}
