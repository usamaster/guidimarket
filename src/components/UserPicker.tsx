const USERS = ['Us', 'Victor', 'Fons', 'Yit', 'Aris']

interface UserPickerProps {
  onSelect: (user: string) => void
}

export function UserPicker({ onSelect }: UserPickerProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-bold text-dark text-center mb-1">Sign in</h1>
        <p className="text-text-muted text-sm text-center mb-6">Choose your account to continue</p>

        <div className="bg-surface rounded-2xl border border-border p-1.5 space-y-0.5">
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
