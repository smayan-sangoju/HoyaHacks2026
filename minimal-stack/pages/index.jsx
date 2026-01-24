import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function Home() {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [productBarcode, setProductBarcode] = useState('')
  const [binBarcode, setBinBarcode] = useState('')
  const [phase, setPhase] = useState('scan-product')
  const [sessionId, setSessionId] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [stream])

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      return s
    } catch (err) {
      console.error(err)
      setStatus('Camera permission denied')
    }
  }

  async function scanBarcode(target) {
    setStatus('Starting camera...')
    const s = await startCamera()
    if (!s) return
    setStatus('Point camera at barcode')
    const codeReader = new BrowserMultiFormatReader()
    try {
      const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current)
      if (target === 'product') {
        setProductBarcode(result.text)
        setPhase('scan-bin')
        // start session on server
        const res = await fetch('/api/session/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productBarcode: result.text }) })
        const jr = await res.json()
        if (jr.sessionId) setSessionId(jr.sessionId)
      } else {
        setBinBarcode(result.text)
        setPhase('ready-record')
        if (sessionId) {
          await fetch('/api/session/bin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, binBarcode: result.text }) })
        }
      }
    } catch (err) {
      console.warn('scan failed', err)
      setStatus('Scan failed: ' + err?.message)
    } finally {
      codeReader.reset()
      // stop camera
      s.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }

  // record 2s video and extract 2 frames
  async function recordAndSubmit() {
    setStatus('Preparing camera...')
    const s = await startCamera()
    if (!s) return
    setStatus('Recording 2s...')
    const mediaRecorder = new MediaRecorder(s, { mimeType: 'video/webm; codecs=vp8' })
    const chunks = []
    mediaRecorder.ondataavailable = e => chunks.push(e.data)
    mediaRecorder.start()
    await new Promise(r => setTimeout(r, 2000))
    mediaRecorder.stop()
    await new Promise(resolve => { mediaRecorder.onstop = resolve })
    const blob = new Blob(chunks, { type: 'video/webm' })
    // extract two frames via canvas
    const frames = await extractFramesFromBlob(blob, 2)
    setStatus('Uploading...')
    const fd = new FormData()
    fd.append('sessionId', sessionId)
    fd.append('productBarcode', productBarcode)
    fd.append('binBarcode', binBarcode)
    fd.append('video', blob, 'clip.webm')
    fd.append('frames', JSON.stringify(frames))
    const res = await fetch('/api/verify', { method: 'POST', body: fd })
    const jr = await res.json()
    setStatus('Result: ' + (jr.ok ? `Verified (+${jr.points || 0} pts)` : `Rejected: ${jr.reason || jr.error}`))
    // stop camera
    s.getTracks().forEach(t => t.stop())
    setStream(null)
  }

  async function extractFramesFromBlob(blob, count = 2) {
    // create a video element to play the blob and capture frames
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob)
      const video = document.createElement('video')
      video.src = url
      video.muted = true
      video.playsInline = true
      video.onloadedmetadata = async () => {
        const duration = video.duration || 2
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        const times = [0.3, 1.0].map(t => Math.min(duration, t))
        const images = []
        let i = 0
        const capture = async () => {
          if (i >= times.length) {
            URL.revokeObjectURL(url)
            resolve(images)
            return
          }
          video.currentTime = times[i]
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            images.push(canvas.toDataURL('image/jpeg', 0.8))
            i++
            capture()
          }
        }
        capture()
      }
      video.onerror = () => resolve([])
    })
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>ClearCycle — Minimal Demo</h1>
      <p>Phase: {phase}</p>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: 480, borderRadius: 8, background: '#000' }}></video>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {phase === 'scan-product' && <button onClick={() => scanBarcode('product')}>Scan product barcode</button>}
        {phase === 'scan-bin' && <button onClick={() => scanBarcode('bin')}>Scan bin barcode</button>}
        {phase === 'ready-record' && <button onClick={recordAndSubmit}>Record 2s & Submit</button>}
      </div>
      <div style={{ marginTop: 12 }}>
        <div>Product: {productBarcode}</div>
        <div>Bin: {binBarcode}</div>
        <div>Session: {sessionId}</div>
      </div>
      <div style={{ marginTop: 12, color: '#444' }}>{status}</div>
    </div>
  )
}
