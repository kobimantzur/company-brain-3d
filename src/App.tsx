import { CompanyBrain, type Brain } from './lib'
import demo from './data/demo.json'

export default function App() {
  return <CompanyBrain data={demo as Brain} onSelect={(node, path) => console.log('select', path.join(' / '), node.title)} />
}
