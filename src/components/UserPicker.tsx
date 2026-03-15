const USERS = ['Us', 'Victor', 'Fons', 'Yit', 'Aris']

interface UserPickerProps {
  onSelect: (user: string) => void
}

export function UserPicker({ onSelect }: UserPickerProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-[28px] font-medium tracking-tight text-dark">
            guidi<span className="text-primary font-bold">market</span>
          </span>
          <p className="text-text-secondary text-sm mt-2">Who are you?</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-2 space-y-1">
          {USERS.map(user => (
            <button
              key={user}
              onClick={() => onSelect(user)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg transition-colors cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                {user[0]}
              </div>
              <span className="text-sm font-medium text-dark">{user}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
