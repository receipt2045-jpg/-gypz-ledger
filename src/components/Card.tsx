import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-card bg-card p-5 shadow-card ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''} transition-transform ${className}`}
    >
      {children}
    </div>
  )
}
