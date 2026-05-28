import { LayoutGrid, List } from 'lucide-react'
import SegmentedControl from '../SegmentedControl'

export type ListViewMode = 'cards' | 'table'

interface Props {
  value: ListViewMode
  onChange: (value: ListViewMode) => void
  cardsLabel: string
  tableLabel: string
  size?: 'sm' | 'md'
  ariaLabel?: string
}

export default function ListViewToggle({ value, onChange, cardsLabel, tableLabel, size = 'md', ariaLabel }: Props) {
  return (
    <SegmentedControl<ListViewMode>
      value={value}
      onChange={onChange}
      size={size}
      ariaLabel={ariaLabel}
      options={[
        { value: 'cards', label: cardsLabel, icon: LayoutGrid },
        { value: 'table', label: tableLabel, icon: List },
      ]}
    />
  )
}
