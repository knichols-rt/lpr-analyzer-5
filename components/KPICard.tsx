'use client'

interface KPICardProps {
  title: string
  value: number | string
  onClick?: () => void
  className?: string
  tooltip?: string
}

export default function KPICard({ title, value, onClick, className = '', tooltip }: KPICardProps) {
  return (
    <div 
      className={`kpi-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      title={tooltip}
    >
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{title}</div>
    </div>
  )
}