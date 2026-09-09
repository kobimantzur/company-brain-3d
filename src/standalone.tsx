/** Standalone entry for the embeddable bundle: reads ?src= (a brain JSON URL) or falls back to the demo. */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CompanyBrain, type Brain } from './lib'
import demo from './data/demo.json'

function Standalone() {
  const params = new URLSearchParams(location.search)
  const src = params.get('src')
  const [data, setData] = useState<Brain>(demo as Brain)
  useEffect(() => { if (src) fetch(src).then((r) => r.json()).then(setData).catch(() => {}) }, [src])
  const height = params.get('height') ?? '100%'
  // tell the embedding page how tall we'd like to be, so an iframe can shrink-wrap the brain
  useEffect(() => {
    const post = () => parent.postMessage({ type: 'company-brain:height', height: document.querySelector('.cb-root')?.getBoundingClientRect().height ?? 0 }, '*')
    const id = setInterval(post, 400)
    const stop = setTimeout(() => clearInterval(id), 6000)
    return () => { clearInterval(id); clearTimeout(stop) }
  }, [])
  return <CompanyBrain data={data} height={height} maxWidth={params.get('maxWidth') ?? undefined} zoom={Number(params.get('zoom')) || 1} autoRotate={params.get('autoRotate') !== '0'} scrollZoom={params.get('scrollZoom') === '1'} />
}
createRoot(document.getElementById('root')!).render(<Standalone />)
