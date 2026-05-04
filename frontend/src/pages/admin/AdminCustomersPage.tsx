import { useEffect, useState } from 'react'
import { Input, Select, Table, Tag, message } from 'antd'
import { api } from '../../api/client'

interface Badge { consultant_id: string; consultant_name: string; is_me: boolean }
interface CTag { id: string; name: string; color: string }
interface CProduct { product_id: string; product_name: string; is_refunded: boolean }
interface RowItem {
  customer_id: string
  customer_name: string
  phone: string
  customer_info: string
  added_date: string
  other_contact: string | null
  wechat_name: string | null
  sales_name: string | null
  tags: CTag[]
  products: CProduct[]
  consultants: Badge[]
  asset_status: 'normal' | 'dealed' | 'consulting'
  created_at: string
}

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<RowItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [view, setView] = useState<'all' | 'dealed' | 'consulting'>('all')

  const fetchRows = async (k = keyword, v = view) => {
    setLoading(true)
    try {
      const q: string[] = []
      if (k) q.push(`keyword=${encodeURIComponent(k)}`)
      if (v) q.push(`view=${v}`)
      const query = q.length ? `?${q.join('&')}` : ''
      setRows(await api.get<RowItem[]>(`/admin/customers${query}`))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载客户资产失败')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows('', 'all') }, [])

  const columns = [
    {
      title: '客户',
      key: 'customer',
      width: 220,
      render: (_: unknown, r: RowItem) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.customer_name}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.phone || '-'} {r.customer_info ? `· ${r.customer_info}` : ''}</div>
        </div>
      ),
    },
    {
      title: '加粉日期',
      dataIndex: 'added_date',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '其他联系方式',
      dataIndex: 'other_contact',
      width: 180,
      render: (v: string | null) => v || '—',
    },
    { title: '微信号', dataIndex: 'wechat_name', width: 120, render: (v: string | null) => v || '—' },
    { title: '来源销售', dataIndex: 'sales_name', width: 120, render: (v: string | null) => v || '—' },
    {
      title: '标签',
      key: 'tags',
      width: 220,
      render: (_: unknown, r: RowItem) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.tags.map((t) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}</div>,
    },
    {
      title: '已购课程',
      key: 'products',
      width: 220,
      render: (_: unknown, r: RowItem) => <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{r.products.map((p) => <Tag key={p.product_id} style={{ textDecoration: p.is_refunded ? 'line-through' : 'none', color: p.is_refunded ? '#cf1322' : '#135200', borderColor: 'transparent', background: p.is_refunded ? '#fff1f0' : '#e6fffb' }}>{p.product_name}</Tag>)}</div>,
    },
    {
      title: '服务咨询师',
      key: 'consultants',
      width: 200,
      render: (_: unknown, r: RowItem) => {
        if (!r.consultants.length) return <span style={{ color: '#bfbfbf' }}>—</span>
        return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{r.consultants.map((c) => <Tag key={c.consultant_id} color="green">{c.consultant_name}</Tag>)}</div>
      },
    },
    {
      title: '资产状态',
      dataIndex: 'asset_status',
      width: 110,
      render: (v: 'normal' | 'dealed' | 'consulting') => {
        if (v === 'consulting') return <Tag color="blue">咨询中</Tag>
        if (v === 'dealed') return <Tag color="green">已成交</Tag>
        return <Tag>全部客户</Tag>
      },
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>客户资产</h2>
          <p className="page-subtitle">默认展示全部客户，支持按已成交与咨询中筛选</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select
            style={{ width: 140 }}
            value={view}
            onChange={(v) => { setView(v); fetchRows(keyword, v) }}
            options={[
              { value: 'all', label: '全部客户' },
              { value: 'dealed', label: '已成交' },
              { value: 'consulting', label: '咨询中' },
            ]}
          />
          <Input.Search placeholder="搜索客户/标签" style={{ width: 280 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={(v) => fetchRows(v, view)} />
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, overflow: 'hidden' }}>
        <Table rowKey="customer_id" dataSource={rows} columns={columns} loading={loading} pagination={false} />
      </div>
    </div>
  )
}
