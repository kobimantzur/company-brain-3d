/** Dev-only: how many lenses / segments hold up before it gets crowded. */
import { createRoot } from 'react-dom/client'
import { CompanyBrain, type Brain } from './lib'

const seg = (p: string, n: number, kids = 0) => Array.from({ length: n }, (_, i) => ({
  id: `${p}-${i}`, title: `${p.toUpperCase()} segment ${i + 1}`, description: 'One plain line describing this segment.',
  children: kids ? Array.from({ length: kids }, (_, k) => ({ id: `${p}-${i}-${k}`, title: `Child ${k + 1}` })) : undefined,
}))

/** 6 levels deep, to see how far nesting holds up. */
const deep = (depth: number, prefix = 'd'): any => depth === 0 ? undefined :
  Array.from({ length: depth > 4 ? 3 : 4 }, (_, i) => ({
    id: `${prefix}-${i}`, title: `L${7 - depth} · node ${i + 1}`, value: `${depth * 11}K`,
    description: 'A node at this depth.', children: deep(depth - 1, `${prefix}-${i}`),
  }))

const brain: Brain = {
  version: 1, title: 'Stress', children: [
    { id: 'deep', title: 'Six levels', children: deep(5) },
    { id: 'a', title: 'Three lenses', children: seg('a', 5, 3) },
    { id: 'b', title: 'Eight segments', children: seg('b', 8, 2) },
    { id: 'c', title: 'Twelve segments', children: seg('c', 12, 2) },
    { id: 'e', title: 'Twenty segments', children: seg('e', 20, 2) },
  ],
}
createRoot(document.getElementById('root')!).render(<CompanyBrain data={brain} height="100vh" />)
