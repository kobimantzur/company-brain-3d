/** Standalone entry for the embeddable bundle: reads ?src= (a brain JSON URL) or falls back to the demo.
 *  ?theme=light|dark sets the look; a host page can also switch it live by posting
 *  { type: 'company-brain:theme', theme: 'light' | 'dark' } to the iframe. */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CompanyBrain, type Brain } from './lib'
import demo from './data/demo.json'

type Theme = 'dark' | 'light'

function Standalone() {
  const params = new URLSearchParams(location.search)
  const src = params.get('src')
  const [data, setData] = useState<Brain>(demo as Brain)
  const [theme, setTheme] = useState<Theme>(params.get('theme') === 'light' ? 'light' : 'dark')
  useEffect(() => { if (src) fetch(src).then((r) => r.json()).then(setData).catch(() => {}) }, [src])
  const height = params.get('height') ?? '100%'
  // tell the embedding page how tall we'd like to be, so an iframe can shrink-wrap the brain
  useEffect(() => {
    const post = () => parent.postMessage({ type: 'company-brain:height', height: document.querySelector('.cb-root')?.getBoundingClientRect().height ?? 0 }, '*')
    const id = setInterval(post, 400)
    const stop = setTimeout(() => clearInterval(id), 6000)
    return () => { clearInterval(id); clearTimeout(stop) }
  }, [])
  // follow the host page's theme toggle without reloading the iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => { const t = e.data?.theme; if (e.data?.type === 'company-brain:theme' && (t === 'light' || t === 'dark')) setTheme(t) }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  useEffect(() => { document.documentElement.style.colorScheme = theme; document.body.style.background = 'transparent' }, [theme])
  return <CompanyBrain data={data} theme={theme} height={height} maxWidth={params.get('maxWidth') ?? undefined} zoom={Number(params.get('zoom')) || 1} autoRotate={params.get('autoRotate') !== '0'} scrollZoom={params.get('scrollZoom') === '1'} />
}
createRoot(document.getElementById('root')!).render(<Standalone />)
