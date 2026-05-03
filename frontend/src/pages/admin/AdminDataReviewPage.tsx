import { useEffect, useState } from 'react'
import { Select, Table } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../api/client'

interface SalesCapacityItem { user_id: string; name: string; new_customers: number; order_count: number; deal_amount: number }
interface SourceChannelItem { source: string; count: number }
interface ProductDealItem { product_id: string; product_name: string; order_count: number; deal_amount: number }
interface ConsultantDeliveryItem { user_id: string; name: string; service_customers: number; meetings_this_month: number }
interface DashboardData {
  sales_capacity: SalesCapacityItem[]
  source_channels: SourceChannelItem[]
  product_deals: ProductDealItem[]
  consultant_delivery: ConsultantDeliveryItem[]
}

const y2f = (cents: number) => (cents / 100).toLocaleString()

export default function AdminDataReviewPage() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [data, setData] = useState<DashboardData | null>(null)

  const fetchData = async (m = month) => {
    setData(await api.get<DashboardData>(`/admin/dashboard?month=${m}`))
  }

  useEffect(() => { fetchData(dayjs().format('YYYY-MM')) }, [])

  if (!data) return null

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>数据复盘</h2>
          <p className="page-subtitle">默认展示本月四大区块总览</p>
        </div>
        <Select
          value={month}
          style={{ width: 220 }}
          onChange={(v) => { setMonth(v); fetchData(v) }}
          options={Array.from({ length: 12 }).map((_, i) => {
            const d = dayjs().subtract(i, 'month')
            return { label: d.format('YYYY 年 M 月'), value: d.format('YYYY-MM') }
          })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>销售产能</h3>
          <Table
            rowKey="user_id"
            dataSource={data.sales_capacity}
            pagination={false}
            size="small"
            columns={[
              { title: '销售', dataIndex: 'name', width: 120 },
              { title: '新增客户', dataIndex: 'new_customers', width: 90 },
              { title: '成交单数', dataIndex: 'order_count', width: 90 },
              { title: '成交金额', dataIndex: 'deal_amount', render: (v: number) => `¥${y2f(v)}` },
            ]}
          />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>来源渠道</h3>
          <Table
            rowKey="source"
            dataSource={data.source_channels}
            pagination={false}
            size="small"
            columns={[
              { title: '渠道', dataIndex: 'source' },
              { title: '客户数', dataIndex: 'count', width: 100 },
            ]}
          />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>产品成交</h3>
          <Table
            rowKey="product_id"
            dataSource={data.product_deals}
            pagination={false}
            size="small"
            columns={[
              { title: '产品', dataIndex: 'product_name' },
              { title: '成交单数', dataIndex: 'order_count', width: 100 },
              { title: '成交金额', dataIndex: 'deal_amount', render: (v: number) => `¥${y2f(v)}`, width: 120 },
            ]}
          />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>咨询师交付</h3>
          <Table
            rowKey="user_id"
            dataSource={data.consultant_delivery}
            pagination={false}
            size="small"
            columns={[
              { title: '咨询师', dataIndex: 'name' },
              { title: '在服务客户', dataIndex: 'service_customers', width: 110 },
              { title: '本月会议数', dataIndex: 'meetings_this_month', width: 110 },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
