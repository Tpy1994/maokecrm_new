import { useEffect, useState, useCallback } from 'react'
import { Table, Modal, Form, Input, Select, DatePicker, Popconfirm, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../../api/client'

interface LinkAccount {
  id: string; account_id: string; customer_count: number; is_active: boolean
}
interface CustomerTag {
  id: string; name: string; color: string
}
interface CustomerProduct {
  product_id: string; product_name: string; price: number; is_refunded: boolean; order_id: string | null
}
interface Customer {
  id: string; name: string; phone: string; industry: string | null; region: string | null
  link_account_id: string; link_account_name: string | null
  tags: CustomerTag[]; products: CustomerProduct[]
  note: string | null; next_follow_up: string | null; follow_up_overdue: boolean
}
interface ProductOption {
  id: string; name: string; price: number; is_consultation: boolean; status: string
}
interface TagOption {
  id: string; name: string; color: string; category_name: string
}

const y2f = (cents: number) => {
  const yuan = cents / 100
  if (yuan >= 10000) return `${(yuan / 10000).toFixed(1)} 万`
  return yuan.toLocaleString()
}

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [linkAccounts, setLinkAccounts] = useState<LinkAccount[]>([])
  const [selectedLA, setSelectedLA] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [customerForm] = Form.useForm()

  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [purchaseCustomer, setPurchaseCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)

  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [tagCustomer, setTagCustomer] = useState<Customer | null>(null)
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Inline note editing state
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null)
  const [noteEditValue, setNoteEditValue] = useState('')

  // ─── Fetch ───

  const fetchLinkAccounts = useCallback(async () => {
    setLinkAccounts(await api.get<LinkAccount[]>('/sales/link-accounts'))
  }, [])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = selectedLA ? `?link_account_id=${selectedLA}` : ''
      setCustomers(await api.get<Customer[]>(`/sales/customers${params}`))
    } finally { setLoading(false) }
  }, [selectedLA])

  const fetchProducts = async () => {
    setProducts(await api.get<ProductOption[]>('/sales/products'))
  }

  const fetchAllTags = async () => {
    setAllTags(await api.get<TagOption[]>('/sales/tags'))
  }

  useEffect(() => { fetchLinkAccounts() }, [fetchLinkAccounts])
  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // ─── Actions ───

  const createCustomer = async () => {
    const v = await customerForm.validateFields()
    try {
      await api.post('/sales/customers', v)
      message.success('客户已创建'); setAddOpen(false); customerForm.resetFields(); fetchCustomers()
    } catch (e) { message.error(e instanceof Error ? e.message : '失败') }
  }

  const updateCustomer = async () => {
    if (!editing) return
    const v = await customerForm.validateFields()
    try {
      await api.put(`/sales/customers/${editing.id}`, { name: v.name, phone: v.phone, industry: v.industry, region: v.region })
      message.success('已更新'); setEditing(null); customerForm.resetFields(); fetchCustomers()
    } catch (e) { message.error(e instanceof Error ? e.message : '失败') }
  }

  const saveNote = async (customerId: string, note: string | null, nextFollowUp: string | null) => {
    try {
      await api.put(`/sales/customers/${customerId}`, { note, next_follow_up: nextFollowUp })
      fetchCustomers()
    } catch { message.error('更新失败') }
  }

  const addTag = async () => {
    if (!tagCustomer || !selectedTag) return
    await api.post(`/sales/customers/${tagCustomer.id}/tags`, { tag_id: selectedTag })
    message.success('标签已添加'); setTagPickerOpen(false); setSelectedTag(null); fetchCustomers()
  }

  const removeTag = async (customerId: string, tagId: string) => {
    await api.delete(`/sales/customers/${customerId}/tags/${tagId}`)
    fetchCustomers()
  }

  const purchase = async () => {
    if (!purchaseCustomer || !selectedProduct) return
    const product = products.find(p => p.id === selectedProduct)
    try {
      const res = await api.post<{ message: string }>(`/sales/customers/${purchaseCustomer.id}/purchase`, {
        product_id: selectedProduct, amount: product?.price || 0,
      })
      message.success(res.message || '成交成功'); setProductPickerOpen(false); setSelectedProduct(null); fetchCustomers()
    } catch (e) { message.error(e instanceof Error ? e.message : '成交失败') }
  }

  const refund = async (orderId: string) => {
    try {
      const res = await api.post<{ impact: string; amount: number }>(`/sales/orders/${orderId}/refund`)
      message.success(`已退款 ¥${y2f(res.amount)}，${res.impact}`)
      fetchCustomers()
    } catch (e) { message.error(e instanceof Error ? e.message : '退款失败') }
  }

  // ─── Table Columns ───

  const columns = [
    {
      title: '客户', key: 'name', width: 180,
      render: (_: unknown, r: Customer) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: '#8E8E8E' }}>{(r.industry ? r.industry + '·' : '') + (r.region || '')}</div>
        </div>
      ),
    },
    {
      title: '绑定微信', key: 'wechat', width: 120,
      render: (_: unknown, r: Customer) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.link_account_name || '-'}</span>
      ),
    },
    {
      title: '标签', key: 'tags', width: 200,
      render: (_: unknown, r: Customer) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {r.tags.map(t => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '1px 7px', borderRadius: 3, background: t.color + '18', color: t.color, border: '1px solid ' + t.color + '26' }}>
              {t.name}
              <button onClick={() => removeTag(r.id, t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5, padding: 0, fontSize: 11, lineHeight: 1 }}>×</button>
            </span>
          ))}
          <button onClick={() => { setTagCustomer(r); fetchAllTags(); setSelectedTag(null); setTagPickerOpen(true) }}
            style={{ border: '1px dashed #E8E8E3', background: 'none', cursor: 'pointer', color: '#8E8E8E', fontSize: 10, padding: '1px 6px', borderRadius: 3 }}>+</button>
        </div>
      ),
    },
    {
      title: '已购课程', key: 'products', width: 200,
      render: (_: unknown, r: Customer) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {r.products.map(p => (
            <span key={p.product_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '1px 7px', borderRadius: 3, background: p.is_refunded ? '#FEF2F2' : '#F2F2ED', color: p.is_refunded ? '#DC2626' : '#4A4A4A', textDecoration: p.is_refunded ? 'line-through' : 'none', border: `1px solid ${p.is_refunded ? '#DC262620' : '#E8E8E3'}` }}>
              {p.product_name} ¥{y2f(p.price)}
              {!p.is_refunded && p.order_id && (
                <Popconfirm title={`确认退款 ¥${y2f(p.price)}？`} onConfirm={() => refund(p.order_id!)}>
                  <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', opacity: 0.6, padding: 0, fontSize: 11, lineHeight: 1, marginLeft: 2 }}>×</button>
                </Popconfirm>
              )}
            </span>
          ))}
          <button onClick={() => { setPurchaseCustomer(r); fetchProducts(); setSelectedProduct(null); setProductPickerOpen(true) }}
            style={{ border: '1px dashed #E8E8E3', background: 'none', cursor: 'pointer', color: '#1677ff', fontSize: 10, padding: '1px 6px', borderRadius: 3 }}>+添加</button>
        </div>
      ),
    },
    {
      title: '备注', key: 'note', width: 140,
      render: (_: unknown, r: Customer) => {
        const isEditing = noteEditingId === r.id
        return isEditing ? (
          <Input.TextArea size="small" value={noteEditValue} onChange={e => setNoteEditValue(e.target.value)} autoSize
            onBlur={() => { setNoteEditingId(null); saveNote(r.id, noteEditValue || null, r.next_follow_up) }}
            style={{ fontSize: 11 }} autoFocus />
        ) : (
          <div onClick={() => { setNoteEditingId(r.id); setNoteEditValue(r.note || '') }}
            style={{ fontSize: 11, color: r.note ? '#4A4A4A' : '#B8B8B8', cursor: 'pointer', minHeight: 20 }}>
            {r.note || '点击添加备注'}
          </div>
        )
      },
    },
    {
      title: '下次跟进', key: 'follow_up', width: 140,
      render: (_: unknown, r: Customer) => (
        <DatePicker size="small" value={r.next_follow_up ? dayjs(r.next_follow_up) : null}
          onChange={(d) => saveNote(r.id, r.note, d ? d.toISOString() : null)}
          style={{ width: '100%', background: r.follow_up_overdue ? '#FEF2F2' : undefined, borderColor: r.follow_up_overdue ? '#DC2626' : undefined }}
          placeholder="未设置" format="MM-DD" />
      ),
    },
  ]

  const totalCustomers = linkAccounts.reduce((s, a) => s + a.customer_count, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>我的客户</h2>
          <p className="page-subtitle">管理客户信息、成交记录与跟进计划</p>
        </div>
        <button onClick={() => { customerForm.resetFields(); setAddOpen(true) }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#0E0E0E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#4A4A4A'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#0E0E0E'}
        ><PlusOutlined /> 新增客户</button>
      </div>

      {/* Wechat Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setSelectedLA(null)} style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid #E8E8E3', background: selectedLA === null ? '#F2F2ED' : '#fff', color: selectedLA === null ? '#0E0E0E' : '#4A4A4A', fontWeight: selectedLA === null ? 600 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          全部（{totalCustomers}）
        </button>
        {linkAccounts.map(la => (
          <button key={la.id} onClick={() => setSelectedLA(la.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, border: '1px solid #E8E8E3', background: selectedLA === la.id ? '#F2F2ED' : '#fff', fontWeight: selectedLA === la.id ? 600 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: la.is_active ? '#22C55E' : '#B8B8B8' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{la.account_id}</span>
            <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, background: selectedLA === la.id ? '#D4A27F20' : '#F2F2ED', color: selectedLA === la.id ? '#D4A27F' : '#8E8E8E' }}>{la.customer_count}</span>
          </button>
        ))}
        <button style={{ padding: '5px 12px', borderRadius: 7, border: '1px dashed #E8E8E3', background: 'transparent', color: '#8E8E8E', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ 申请绑定新微信</button>
      </div>

      {/* Customer Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', overflow: 'hidden' }}>
        <Table rowKey="id" dataSource={customers} columns={columns} loading={loading} pagination={false} scroll={{ x: 1200 }} />
      </div>

      {/* Add Customer */}
      <Modal title="新增客户" open={addOpen} onOk={createCustomer} onCancel={() => setAddOpen(false)} destroyOnClose width={460}>
        <Form form={customerForm} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="name" label="姓名" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="phone" label="手机号" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="industry" label="行业" style={{ flex: 1 }}><Input placeholder="如：服装" /></Form.Item>
            <Form.Item name="region" label="地域" style={{ flex: 1 }}><Input placeholder="如：浙江杭州" /></Form.Item>
          </div>
          <Form.Item name="link_account_id" label="绑定微信" rules={[{ required: true }]}>
            <Select placeholder="选择微信号">
              {linkAccounts.map(la => (
                <Select.Option key={la.id} value={la.id}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{la.account_id}</span>
                  <span style={{ color: '#8E8E8E', fontSize: 11, marginLeft: 8 }}>{la.customer_count}个客户</span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Customer */}
      <Modal title="编辑客户" open={!!editing} onOk={updateCustomer} onCancel={() => setEditing(null)} destroyOnClose width={460}>
        <Form form={customerForm} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="name" label="姓名" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="phone" label="手机号" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="industry" label="行业" style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="region" label="地域" style={{ flex: 1 }}><Input /></Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Product Picker */}
      <Modal title="选择产品成交" open={productPickerOpen} onOk={purchase} onCancel={() => setProductPickerOpen(false)} okText="确认成交" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {products.filter(p => p.status === 'active').map(p => {
            const isSelected = selectedProduct === p.id
            return (
              <div key={p.id} onClick={() => setSelectedProduct(p.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isSelected ? '#0E0E0E' : '#E8E8E3'}`, background: isSelected ? '#FDFDF7' : '#fff' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  {p.is_consultation && <span style={{ fontSize: 10, color: '#22C55E' }}>咨询类 · 自动入池</span>}
                </div>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 13 }}>¥{y2f(p.price)}</span>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Tag Picker */}
      <Modal title="添加标签" open={tagPickerOpen} onOk={addTag} onCancel={() => setTagPickerOpen(false)} okText="添加" width={420}>
        <Select value={selectedTag} onChange={setSelectedTag} style={{ width: '100%' }} placeholder="搜索并选择标签" showSearch optionFilterProp="label">
          {allTags.map(t => (
            <Select.Option key={t.id} value={t.id} label={t.name}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: t.color, marginRight: 6 }} />
              {t.name}
              <span style={{ color: '#B8B8B8', fontSize: 10, marginLeft: 6 }}>{t.category_name}</span>
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </div>
  )
}
