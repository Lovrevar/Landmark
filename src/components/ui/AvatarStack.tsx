interface AvatarUser {
  id: string
  username?: string
}

interface Props {
  users: AvatarUser[]
  max?: number
  size?: 'xs' | 'sm' | 'md'
  title?: string
}

const sizeClasses: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-7 h-7 text-sm',
}

export default function AvatarStack({ users, max = 3, size = 'xs', title }: Props) {
  if (!users || users.length === 0) return null
  const shown = users.slice(0, max)
  const overflow = users.length - shown.length
  const cls = sizeClasses[size]

  return (
    <div
      className="flex -space-x-1"
      title={title ?? users.map(u => u.username || '?').join(', ')}
    >
      {shown.map(u => (
        <span
          key={u.id}
          className={`${cls} rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center border border-white dark:border-gray-800 font-semibold`}
        >
          {u.username?.charAt(0).toUpperCase() || '?'}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`${cls} rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center border border-white dark:border-gray-800 font-semibold`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
