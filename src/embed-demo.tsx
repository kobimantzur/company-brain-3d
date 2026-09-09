/** Dev-only harness: proves the component behaves as a block in a normal scrolling page. */
import { createRoot } from 'react-dom/client'
import './index.css'
import { CompanyBrain, type Brain } from './lib'
import demo from './data/demo.json'

createRoot(document.getElementById('root')!).render(
  <div style={{ font: '16px/1.6 ui-sans-serif, system-ui', color: '#111', background: '#fff', margin: 0 }}>
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
      <h1 style={{ fontSize: 44, margin: 0 }}>Your company has a brain.</h1>
      <p style={{ color: '#555' }}>Scroll down. The brain below is a plain block element in this page — it should not eat the viewport, and the page should scroll normally past it.</p>
    </section>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #ddd' }}>
        <CompanyBrain data={demo as Brain} height="auto" />
      </div>
    </div>
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>
      <h2 style={{ marginTop: 0 }}>Transparent, on a coloured page, with a custom palette</h2>
      <div style={{ background: 'linear-gradient(135deg,#f6f7fb,#e7ecf7)', borderRadius: 20, padding: 8 }}>
        <CompanyBrain
          data={demo as Brain}
          height="auto"
          background="transparent"
          palette={['#0f766e', '#7c3aed', '#b91c1c', '#a16207', '#0369a1', '#be185d']}
          className="cb-light"
        />
      </div>
    </section>
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
      <h2>Content after the brain</h2>
      <p style={{ color: '#555' }}>If you can read this by scrolling, embedding works.</p>
      {Array.from({ length: 6 }, (_, i) => <p key={i} style={{ color: '#777' }}>Filler paragraph {i + 1}.</p>)}
    </section>
  </div>,
)
