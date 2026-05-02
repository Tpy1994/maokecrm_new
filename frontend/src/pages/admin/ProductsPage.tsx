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
}

const y2f = (cents: number) => {
  const yuan = cents / 100
  if (yuan >= 10000) return `${(yuan / 10000).toFixed(1)} 万`
  return yuan.toLocaleString()
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form] = Form.useForm()

  const fetchProducts = async () => {
    setLoading(true)
    try { setProducts(await api.get<Product[]>('/products/')) } finally { setLoading(false) }
  }

  useEffect(() => { fetchProducts() }, [])

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const payload = { ...values, price: Math.round(Number(values.price) * 100) }
    try {
      editing ? await api.put(`/products/${editing.id}`, payload) : await api.post('/products/', payload)
      message.success(editing ? '产品已更新' : '产品已创建')
      setModalOpen(false); setEditing(null); form.resetFields(); fetchProducts()
    } catch { message.error('操作失败') }
  }

  const toggleStatus = async (r: Product) => {
    await api.put(`/products/${r.id}`, { status: r.status === 'active' ? 'inactive' : 'active' })
    fetchProducts()
  }

  const columns = [
    {
      title: '产品名',
      dataIndex: 'name',
      width: 240,
      render: (_: string, r: Product) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#0E0E0E' }}>{r.name}</span>
          {r.subtitle && <span style={{ fontSize: 11, color: '#8E8E8E', marginLeft: 8 }}>{r.subtitle}</span>}
        </div>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      render: (v: number) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>¥{y2f(v)}</span>,
    },
    {
      title: '咨询类',
      dataIndex: 'is_consultation',
      width: 80,
      render: (v: boolean) => (
        <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 4, background: v ? '#F0FDF4' : '#F2F2ED', color: v ? '#16A34A' : '#8E8E8E' }}>
          {v ? '是' : '否'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="status-dot" style={{ background: v === 'active' ? '#16A34A' : '#B8B8B8' }} />
          <span style={{ fontSize: 12, color: '#4A4A4A' }}>{v === 'active' ? '在售' : '下架'}</span>
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, r: Product) => (
        <div style={{ display: 'flex', gap: 14 }}>
          <button className="action-link" style={{ color: '#4A4A4A' }} onClick={() => {
            setEditing(r); form.setFieldsValue({ ...r, price: r.price / 100 }); setModalOpen(true)
          }}>编辑</button>
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
          <p className="page-subtitle">管理所有产品的信息、定价与咨询类属性</p>
        </div>
        <button
          onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'active', is_consultation: false, price: 0 }); setModalOpen(true) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8,
            border: 'none', background: '#0E0E0E', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#4A4A4A'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#0E0E0E'}
        >
          <PlusOutlined /> 新增产品
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', overflow: 'hidden' }}>
        <Table rowKey="id" dataSource={products} columns={columns} loading={loading} pagination={false} />
      </div>

      <Modal title={editing ? '编辑产品' : '新增产品'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null) }} destroyOnClose width={460}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="产品名称" rules={[{ required: true }]}>
            <Input placeholder="如: 电商管理咨询" />
          </Form.Item>
          <Form.Item name="subtitle" label="副标题">
            <Input placeholder="如: 12个月陪跑服务" />
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
