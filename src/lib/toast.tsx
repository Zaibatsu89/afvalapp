import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast {
  text: string
  undo?: () => void | Promise<void>
}
const Ctx = createContext<(t: Toast) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((n: Toast) => {
    setT(n)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setT(null), 6000)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && (
        <div className="toast" role="status">
          <span>{t.text}</span>
          {t.undo && (
            <button
              onClick={async () => {
                await t.undo!()
                setT(null)
              }}
            >
              Ongedaan maken
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
