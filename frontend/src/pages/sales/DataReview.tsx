import { useEffect, useState } from 'react'
import { Table } from 'antd'
import { api } from '../../api/client'

interface DashboardStats {
  new_this_month: number
  new_yesterday: number
  orders_this_month: number
  amount_this_month: number
  conversion_rate: number
  total_customers: number
}

interface MonthlyOrder {
  order_id: string
  order_date: string
  customer_name: string
  customer_info: string
  product_name: string
  product_price: number
  amount: number
  is_refunded: boolean
  is_first_purchase: boolean
  link_account_name: string | null
  tags: { name: string; color: string }[]
}

const y2f = (cents: number) => {
  const yuan = cents / 100
  if (yuan >= 10000) return `${(yuan / 10000).toFixed(1)} 万`
  return yuan.toLocaleString()
}

const statHints: Record<string, string> = {
  new_this_month: '保持每日新增，转化率才不会掉',
  new_yesterday: '昨日新增是今日的转化潜力',
  orders_this_month: '聚焦成交，别让客户流失',
  amount_this_month: '提升客单价，做更多高价值成交',
  conversion_rate: '双月未成交客户尽快跟进转化',
  total_customers: '持续积累，复购比拉新更高效',
}

export default function DataReview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orders, setOrders] = useState<MonthlyOrder[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const data = await api.get<{ stats: DashboardStats; monthly_orders: MonthlyOrder[] }>('/sales/dashboard')
        setStats(data.stats)
        setOrders(data.monthly_orders)
      } finally { setLoading(false) }
    })()
  }, [])

  if (!stats) return null

  const statCards = [
    { key: 'new_this_month', label: '本月新增客户', value: stats.new_this_month, format: (v: number) => `${v} 人` },
    { key: 'new_yesterday', label: '昨日新增客户', value: stats.new_yesterday, format: (v: number) => `${v} 人` },
    { key: 'orders_this_month', label: '本月成交数', value: stats.orders_this_month, format: (v: number) => `${v} 单` },
    { key: 'amount_this_month', label: '本月成交金额', value: stats.amount_this_month, format: (v: number) => `¥${y2f(v)}`, highlight: true },
    { key: 'conversion_rate', label: '双月转化率', value: stats.conversion_rate, format: (v: number) => `${v}%`, highlight: true },
    { key: 'total_customers', label: '客户总数', value: stats.total_customers, format: (v: number) => `${v} 人` },
  ]

  const columns = [
    {
      title: '成交日期', dataIndex: 'order_date', width: 100,
      render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span>,
    },
    {
      title: '客户', key: 'customer', width: 170,
      render: (_: unknown, r: MonthlyOrder) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{r.customer_name}</span>
          {r.customer_info ? <span style={{ fontSize: 10, color: '#8E8E8E', marginLeft: 6 }}>{r.customer_info}</span> : null}
        </div>
      ),
    },
    {
      title: '已购产品', key: 'product', width: 180,
      render: (_: unknown, r: MonthlyOrder) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, padding: '2px 8px', borderRadius: 3,
          background: r.is_refunded ? '#FEF2F2' : r.is_first_purchase ? '#FEF2F2' : '#F0FDF4',
          color: r.is_refunded ? '#DC2626' : r.is_first_purchase ? '#DC2626' : '#16A34A',
          textDecoration: r.is_refunded ? 'line-through' : 'none',
          border: `1px solid ${r.is_refunded ? '#DC262620' : r.is_first_purchase ? '#DC262620' : '#16A34A20'}`,
        }}>
          {r.product_name} ¥{y2f(r.product_price)}
        </span>
      ),
    },
    {
      title: '本月金额', dataIndex: 'amount', width: 100,
      render: (_: number, r: MonthlyOrder) => (
        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12, color: r.is_refunded ? '#DC2626' : '#0E0E0E', textDecoration: r.is_refunded ? 'line-through' : 'none' }}>
          ¥{y2f(r.amount)}
        </span>
      ),
    },
    {
      title: '绑定微信', key: 'link_account_name', width: 120,
      render: (_: unknown, r: MonthlyOrder) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.link_account_name || '-'}</span>
      ),
    },
    {
      title: '标签', key: 'tags', width: 180,
      render: (_: unknown, r: MonthlyOrder) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {r.tags.map((t, i) => (
            <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: t.color + '14', color: t.color, border: '1px solid ' + t.color + '26' }}>
              {t.name}
            </span>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>数据复盘</h2>
          <p className="page-subtitle">查看本月的销售表现与客户转化情况</p>
        </div>
      </div>

      {/* 6 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {statCards.map(sc => (
          <div key={sc.key} style={{
            background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 11, color: '#8E8E8E', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
              {sc.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: sc.highlight ? '#0E0E0E' : '#4A4A4A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {sc.format(sc.value)}
            </div>
            <div style={{ fontSize: 11, color: '#B8B8B8', marginTop: 2 }}>
              {statHints[sc.key]}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Order List */}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0E0E0E', margin: '0 0 4px' }}>本月成交清单</h3>
        <p style={{ fontSize: 12, color: '#8E8E8E', margin: 0 }}>
          红色 = 本月新购（新客户首单），绿色 = 本月前已购（老客户加购/复购）
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', overflow: 'hidden' }}>
        <Table rowKey="order_id" dataSource={orders} columns={columns} loading={loading} pagination={false} scroll={{ x: 900 }} />
      </div>
    </div>
  )
}
