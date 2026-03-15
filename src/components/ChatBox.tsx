import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Message } from '../lib/database.types'

interface ChatBoxProps {
  userId: string
  displayName: string
}

export function ChatBox({ userId, displayName }: ChatBoxProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(open)

  useEffect(() => { openRef.current = open }, [open])

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        setMessages(prev => [...prev, msg].slice(-200))
        if (!openRef.current) setUnread(n => n + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

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

  const toggle = () => {
    setOpen(o => !o)
    if (!open) setUnread(0)
  }

  return (
    <>
      <button
        onClick={toggle}
        className="fixed bottom-4 left-4 z-50 w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-no text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 left-4 z-50 w-80 h-96 bg-surface rounded-xl border border-border shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-dark text-white">
            <h3 className="text-sm font-semibold">Chat</h3>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-text-muted text-center mt-8">No messages yet. Say hi!</p>
            )}
            {messages.map(m => {
              const isMe = m.user_id === userId
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-text-muted mb-0.5">{m.display_name}</span>
                  <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm break-words ${
                    isMe
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-bg text-dark rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                  <span className="text-[9px] text-text-muted mt-0.5">
                    {new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="px-3 py-2 border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
