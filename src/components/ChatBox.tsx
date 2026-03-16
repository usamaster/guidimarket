import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Message } from '../lib/database.types'

interface ChatBoxProps {
  userId: string
  displayName: string
}

export function ChatBox({ userId, displayName }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold text-dark mb-3">Chat</h3>

      <div className="h-48 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center mt-8">No messages yet. Say hi!</p>
        )}
        {messages.map(m => {
          const isMe = m.user_id === userId
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-text-muted mb-0.5">{m.display_name}</span>
              <div className={`max-w-[85%] px-2.5 py-1 rounded-lg text-xs break-words ${
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

      <form onSubmit={handleSend} className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 min-w-0 border border-border rounded-lg px-2.5 py-1.5 text-xs bg-surface text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
    </div>
  )
}
