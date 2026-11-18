import { useEffect, useRef, useState } from 'react'

/** Camera binnen de app (geen wissel naar de systeemcamera, dus de pagina blijft staan). */
export function Camera({ onShot, onClose }: { onShot: (b: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let dead = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setErr('Geen toegang tot de camera. Sta de camera toe in Chrome of kies een foto uit de galerij.'))
    return () => {
      dead = true
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function shoot() {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.92)
  }

  return (
    <div className="camera">
      {err ? <p className="warn">{err}</p> : <video ref={video} autoPlay playsInline muted />}
      <div className="row">
        {!err && <button className="primary" onClick={shoot}>📸 Maak foto</button>}
        <button onClick={onClose}>Annuleren</button>
      </div>
    </div>
  )
}
