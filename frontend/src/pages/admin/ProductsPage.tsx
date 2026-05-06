import { useEffect, useState } from 'react'
import { Table, Modal, Form, Input, InputNumber, Switch, Popconfirm, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { api } from '../../api/client'

interface Product {
  id: string
  name: string
  subtitle: string | null
  price: number
  is_consultation: boolean
  status: string
  monthly_deal_count: number
}

const y2f = (yuan: number) => {
  const value = Number(yuan || 0)
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const badgeStyle = {
  fontSize: 12,
  padding: '2px 8px',
  borderRadius: 6,
  fontWeight: 500,
  display: 'inline-block',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form] = Form.useForm()

  const fetchProducts = async () => {
    setLoading(true)
    try {
      setProducts(await api.get<Product[]>('/products/'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const payload = { ...values, price: Number(values.price) }
    try {
      if (editing) await api.put(`/products/${editing.id}`, payload)
      else await api.post('/products/', payload)
      message.success(editing ? '产品已更新' : '产品已创建')
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      fetchProducts()
    } catch {
      message.error('操作失败')
    }
  }

  const toggleStatus = async (r: Product) => {
    await api.put(`/products/${r.id}`, { status: r.status === 'active' ? 'inactive' : 'active' })
    fetchProducts()
  }

  const columns = [
    {
      title: '产品名',
      dataIndex: 'name',
      width: 220,
      render: (_: string, r: Product) => (
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: '#0E0E0E',
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
            }}
            title={r.name}
          >
            {r.name}
          </div>
          {r.subtitle && (
            <div
              style={{
                fontSize: 12,
                color: '#8E8E8E',
                marginTop: 2,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 200,
              }}
              title={r.subtitle}
            >
              {r.subtitle}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      render: (v: number) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{y2f(v)}</span>,
    },
    {
      title: '咨询类',
      dataIndex: 'is_consultation',
      width: 90,
      render: (v: boolean) => (
        <span style={{ ...badgeStyle, background: v ? '#F6E9D2' : '#F2F2ED', color: v ? '#9A6516' : '#8E8E8E' }}>
          {v ? '是' : '否'}
        </span>
      ),
    },
    {
      title: '本月成交',
      dataIndex: 'monthly_deal_count',
      width: 120,
      render: (v: number) => <span style={{ fontWeight: 600, fontSize: 14 }}>{v > 0 ? `${v} 单` : '—'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => (
        <span style={{ ...badgeStyle, background: v === 'active' ? '#DDF2E6' : '#F2F2ED', color: v === 'active' ? '#166534' : '#737373' }}>
          {v === 'active' ? '在售' : '已下架'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, r: Product) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="action-link"
            style={{ color: '#4A4A4A', border: '1px solid #D9D9D9', borderRadius: 8, padding: '3px 10px', background: '#fff' }}
            onClick={() => {
              setEditing(r)
              form.setFieldsValue({ ...r, price: Number(r.price) })
              setModalOpen(true)
            }}
          >
            编辑
          </button>
          <Popconfirm title={r.status === 'active' ? '下架该产品？' : '重新上架？'} onConfirm={() => toggleStatus(r)}>
            <button className="action-link" style={{ color: r.status === 'active' ? '#8E8E8E' : '#16A34A' }}>
              {r.status === 'active' ? '下架' : '上架'}
            </button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>产品管理</h2>
          <p className="page-subtitle">销售选择“成交产品”时的标准列表 · 咨询类产品成交后客户自动进入咨询池</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            form.resetFields()
            form.setFieldsValue({ status: 'active', is_consultation: false, price: 0 })
            setModalOpen(true)
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
            border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
          }}
        >
          <PlusOutlined style={{ fontSize: 12 }} /> 新建产品
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', overflow: 'hidden' }}>
        <Table rowKey="id" dataSource={products} columns={columns} loading={loading} pagination={false} size="small" />
      </div>

      <Modal title={editing ? '编辑产品' : '新增产品'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null) }} destroyOnClose width={460}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="产品名称" rules={[{ required: true }]}>
            <Input placeholder="如：电商管理咨询" />
          </Form.Item>
          <Form.Item name="subtitle" label="副标题">
            <Input placeholder="如：12个月陪跑服务" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="price" label="价格（元）" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} precision={2} />
            </Form.Item>
            <Form.Item name="is_consultation" label="咨询类" valuePropName="checked" style={{ flex: '0 0 72px' }}>
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
