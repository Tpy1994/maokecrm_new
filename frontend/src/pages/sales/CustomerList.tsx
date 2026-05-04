import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { api } from '../../api/client'

interface LinkAccount { id: string; account_id: string; customer_count: number; is_active: boolean }
interface CustomerTag { id: string; name: string; color: string }
interface TagOption { id: string; name: string; color: string; category_name: string }
interface ProductOption { id: string; name: string; price: number; is_consultation: boolean; status: string }
interface CourseItem { enrollment_id: string; product_id: string; product_name: string; amount_paid: number; refunded_amount: number; status: string }
interface Customer {
  id: string
  name: string
  phone: string
  industry: string | null
  region: string | null
  link_account_id: string
  link_account_name: string | null
  tags: CustomerTag[]
  note: string | null
  next_follow_up: string | null
  next_follow_up_status: 'overdue' | 'today' | 'future' | 'unset'
  in_consultation_pool: boolean
  consultation_count: number | null
  courses: CourseItem[]
  total_spent: number
  gifted_tuition_amount: number
  tuition_balance: number
}

type CourseStatusKey =
  | 'purchased_not_started'
  | 'sales_marked_completed'
  | 'purchased_not_started_refunded'
  | 'sales_marked_completed_refunded'
  | 'admin_marked_completed'
  | 'admin_marked_completed_refunded'

const COURSE_STATUS_META: Record<CourseStatusKey, { label: string; bg: string; color: string; border: string }> = {
  purchased_not_started: { label: '已购未上', bg: '#FDECEC', color: '#B42318', border: '#F7CACA' },
  sales_marked_completed: { label: '销售标记已上', bg: '#EAF8EE', color: '#166534', border: '#BFE7CB' },
  admin_marked_completed: { label: '管理员销课已上（扣结余）', bg: '#EAF2FF', color: '#1D4ED8', border: '#BFDBFE' },
  purchased_not_started_refunded: { label: '已购未上+退款', bg: '#FDECEC', color: '#B42318', border: '#F7CACA' },
  sales_marked_completed_refunded: { label: '销售标记已上+退款', bg: '#EAF8EE', color: '#166534', border: '#BFE7CB' },
  admin_marked_completed_refunded: { label: '管理员销课+退款', bg: '#EAF2FF', color: '#1D4ED8', border: '#BFDBFE' },
}

const y2f = (cents: number) => `¥${(cents / 100).toLocaleString()}`

const followUpLabel = (item: Customer) => {
  if (!item.next_follow_up) return '未设置'
  const d = dayjs(item.next_follow_up)
  if (item.next_follow_up_status === 'today') return `今天\n${d.format('HH:00')}`
  return `${d.format('M/D')}\n${d.format('HH:00')}`
}

const salesStatusSet = new Set<CourseStatusKey>([
  'purchased_not_started',
  'sales_marked_completed',
  'purchased_not_started_refunded',
  'sales_marked_completed_refunded',
])

export default function CustomerList() {
  const [linkAccounts, setLinkAccounts] = useState<LinkAccount[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedLA, setSelectedLA] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  const [addWechatOpen, setAddWechatOpen] = useState(false)
  const [addWechatForm] = Form.useForm()

  const [tagTarget, setTagTarget] = useState<Customer | null>(null)
  const [tagOptions, setTagOptions] = useState<TagOption[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const [courseTarget, setCourseTarget] = useState<Customer | null>(null)
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [newCourseAmount, setNewCourseAmount] = useState<number | null>(null)
  const [activeCourseKey, setActiveCourseKey] = useState<string | null>(null)
  const [courseActionLoadingKey, setCourseActionLoadingKey] = useState<string | null>(null)
  const [editingAmountCourse, setEditingAmountCourse] = useState<{ customerId: string; enrollmentId: string; amountPaid: number } | null>(null)
  const [editingRefundCourse, setEditingRefundCourse] = useState<{ customerId: string; enrollmentId: string; maxRefund: number } | null>(null)
  const [amountForm] = Form.useForm<{ amount_yuan: number }>()
  const [refundForm] = Form.useForm<{ refund_yuan: number }>()

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<CourseStatusKey>('purchased_not_started')

  const [editingNoteCustomerId, setEditingNoteCustomerId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNoteCustomerId, setSavingNoteCustomerId] = useState<string | null>(null)
  const [savedNoteCustomerId, setSavedNoteCustomerId] = useState<string | null>(null)
  const [editingNextCustomerId, setEditingNextCustomerId] = useState<string | null>(null)

  const fetchLinkAccounts = useCallback(async () => {
    setLinkAccounts(await api.get<LinkAccount[]>('/sales/link-accounts'))
  }, [])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const q: string[] = []
      if (selectedLA) q.push(`link_account_id=${encodeURIComponent(selectedLA)}`)
      if (keyword.trim()) q.push(`keyword=${encodeURIComponent(keyword.trim())}`)
      const query = q.length ? `?${q.join('&')}` : ''
      setCustomers(await api.get<Customer[]>(`/sales/customers${query}`))
    } finally {
      setLoading(false)
    }
  }, [selectedLA, keyword])

  const fetchTags = async () => setTagOptions(await api.get<TagOption[]>('/sales/tags'))
  const fetchProducts = async () => setProductOptions(await api.get<ProductOption[]>('/sales/products'))

  useEffect(() => { fetchLinkAccounts() }, [fetchLinkAccounts])
  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const totalCustomers = useMemo(() => linkAccounts.reduce((s, a) => s + a.customer_count, 0), [linkAccounts])

  const submitAddWechat = async () => {
    const v = await addWechatForm.validateFields()
    await api.post('/sales/link-accounts', { account_id: v.account_id })
    message.success('微信号已新增')
    setAddWechatOpen(false)
    addWechatForm.resetFields()
    fetchLinkAccounts()
  }

  const saveNote = async (customerId: string, value: string) => {
    setSavingNoteCustomerId(customerId)
    try {
      const nextValue = value.trim() ? value : null
      await api.put(`/sales/customers/${customerId}`, { note: nextValue })
      setCustomers((prev) => prev.map((item) => (item.id === customerId ? { ...item, note: nextValue } : item)))
      setSavedNoteCustomerId(customerId)
      setTimeout(() => setSavedNoteCustomerId((curr) => (curr === customerId ? null : curr)), 1200)
    } finally {
      setSavingNoteCustomerId(null)
    }
  }

  const saveFollowUp = async (id: string, value: string | null, note?: string | null) => {
    await api.put(`/sales/customers/${id}`, { next_follow_up: value, note: note ?? undefined })
    fetchCustomers()
  }

  const addTag = async () => {
    if (!tagTarget || !selectedTag) return
    await api.post(`/sales/customers/${tagTarget.id}/tags`, { tag_id: selectedTag })
    message.success('标签已添加')
    setTagTarget(null)
    setSelectedTag(null)
    fetchCustomers()
  }

  const removeTag = async (customerId: string, tagId: string) => {
    await api.delete(`/sales/customers/${customerId}/tags/${tagId}`)
    fetchCustomers()
  }

  const addCourse = async () => {
    if (!courseTarget || !selectedProductId) return
    await api.post(`/sales/customers/${courseTarget.id}/courses`, { product_id: selectedProductId, amount: newCourseAmount ?? undefined })
    message.success('已购课程已新增，默认状态为已购未上')
    setCourseTarget(null)
    setSelectedProductId(null)
    setNewCourseAmount(null)
    fetchCustomers()
  }

  const updateCourseStatus = async (customerId: string, enrollmentId: string, status: CourseStatusKey) => {
    if (!salesStatusSet.has(status)) return
    const actionKey = `${customerId}:${enrollmentId}:status`
    setCourseActionLoadingKey(actionKey)
    try {
      await api.put(`/sales/customers/${customerId}/courses/${enrollmentId}/status`, { status })
      await fetchCustomers()
    } finally {
      setCourseActionLoadingKey(null)
    }
  }

  const updateCourseAmount = async (customerId: string, enrollmentId: string, amountPaid: number) => {
    const actionKey = `${customerId}:${enrollmentId}:amount`
    setCourseActionLoadingKey(actionKey)
    try {
      await api.put(`/sales/customers/${customerId}/courses/${enrollmentId}/amount`, { amount_paid: amountPaid })
      message.success('课程实付金额已更新')
      await fetchCustomers()
    } finally {
      setCourseActionLoadingKey(null)
    }
  }

  const refundCourse = async (customerId: string, enrollmentId: string, amount: number) => {
    const actionKey = `${customerId}:${enrollmentId}:refund`
    setCourseActionLoadingKey(actionKey)
    try {
      await api.post(`/sales/customers/${customerId}/courses/${enrollmentId}/refund`, { refund_amount: amount })
      message.success('退款成功')
      await fetchCustomers()
    } finally {
      setCourseActionLoadingKey(null)
    }
  }

  const revertRefundCourse = async (customerId: string, enrollmentId: string) => {
    const actionKey = `${customerId}:${enrollmentId}:revert`
    setCourseActionLoadingKey(actionKey)
    try {
      await api.post(`/sales/customers/${customerId}/courses/${enrollmentId}/refund/revert`, {})
      message.success('已撤销退款')
      await fetchCustomers()
    } finally {
      setCourseActionLoadingKey(null)
    }
  }

  const columns = [
    { title: '客户', width: 130, render: (_: unknown, r: Customer) => <div><div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{r.name}</div><div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.2, marginTop: 2 }}>{r.phone}</div></div> },
    {
      title: '标签', width: 130,
      render: (_: unknown, r: Customer) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {r.tags.map((t) => (
            <Tag key={t.id} color={t.color} style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '14px', paddingInline: 6 }}>
              {t.name}
              <button onClick={() => removeTag(r.id, t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, marginLeft: 4, fontSize: 10 }}>×</button>
            </Tag>
          ))}
          <button onClick={() => { setTagTarget(r); setSelectedTag(null); fetchTags() }} style={{ border: '1px dashed #E8E8E3', background: 'none', cursor: 'pointer', color: '#8E8E8E', fontSize: 10, padding: '0 5px', borderRadius: 3, lineHeight: '14px' }}>+</button>
        </div>
      )
    },
    {
      title: '已购课程', width: 210,
      render: (_: unknown, r: Customer) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {r.courses.map((c) => {
            const meta = COURSE_STATUS_META[c.status as CourseStatusKey]
            const isRefunded = c.status.includes('refunded')
            const courseKey = `${r.id}:${c.enrollment_id}`
            const isActive = activeCourseKey === courseKey
            const maxRefund = Math.max(c.amount_paid - c.refunded_amount, 0)
            return (
              <div key={c.enrollment_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <button
                  onClick={() => {
                    setActiveCourseKey(courseKey)
                    void updateCourseStatus(r.id, c.enrollment_id, selectedStatusFilter)
                  }}
                  style={{
                    border: `1px solid ${isActive ? '#3B82F6' : (meta?.border || '#d9d9d9')}`,
                    background: meta?.bg || '#f5f5f5',
                    color: meta?.color || '#595959',
                    borderRadius: 4,
                    padding: '1px 6px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    width: 'fit-content',
                    maxWidth: '100%',
                    fontSize: 11,
                  }}
                >
                  <span style={{ textDecoration: isRefunded ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{c.product_name}</span>
                </button>
                {isActive ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      disabled={courseActionLoadingKey !== null}
                      onClick={() => {
                        setEditingAmountCourse({ customerId: r.id, enrollmentId: c.enrollment_id, amountPaid: c.amount_paid })
                        amountForm.setFieldsValue({ amount_yuan: Number((c.amount_paid / 100).toFixed(2)) })
                      }}
                      style={{ border: '1px solid #d9d9d9', background: '#fff', borderRadius: 4, fontSize: 10, padding: '0 6px', cursor: 'pointer' }}
                    >改价</button>
                    <button
                      disabled={isRefunded || maxRefund <= 0 || courseActionLoadingKey !== null}
                      onClick={() => {
                        setEditingRefundCourse({ customerId: r.id, enrollmentId: c.enrollment_id, maxRefund })
                        refundForm.setFieldsValue({ refund_yuan: Number((maxRefund / 100).toFixed(2)) })
                      }}
                      style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: 4, fontSize: 10, padding: '0 6px', cursor: 'pointer' }}
                    >退款</button>
                    <button
                      disabled={!isRefunded || courseActionLoadingKey !== null}
                      onClick={() => void revertRefundCourse(r.id, c.enrollment_id)}
                      style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, fontSize: 10, padding: '0 6px', cursor: 'pointer' }}
                    >撤销退款</button>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{y2f(c.amount_paid)} / 已退 {y2f(c.refunded_amount)}</span>
                  </div>
                ) : null}
              </div>
            )
          })}
          <button onClick={() => { setCourseTarget(r); setSelectedProductId(null); fetchProducts() }} style={{ border: '1px dashed #E8E8E3', background: 'none', cursor: 'pointer', color: '#8E8E8E', fontSize: 10, padding: '0 5px', borderRadius: 3, width: 'fit-content', lineHeight: '14px' }}>+</button>
        </div>
      )
    },
    { title: '累计花费', width: 95, render: (_: unknown, r: Customer) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{y2f(r.total_spent)}</span> },
    { title: '学费结余', width: 95, render: (_: unknown, r: Customer) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#16A34A' }}>{y2f(r.tuition_balance)}</span> },
    {
      title: '备注', width: 160,
      render: (_: unknown, r: Customer) => {
        const isEditing = editingNoteCustomerId === r.id
        const isSaving = savingNoteCustomerId === r.id
        const isSaved = savedNoteCustomerId === r.id
        if (!isEditing) {
          return <div onClick={() => { setEditingNoteCustomerId(r.id); setNoteDraft(r.note || '') }} style={{ minHeight: 22, padding: '2px 6px', border: '1px solid transparent', borderRadius: 6, cursor: 'text', fontSize: 12, lineHeight: 1.4 }}>{r.note || <span style={{ color: '#bfbfbf' }}>点击填写备注</span>}</div>
        }
        return (
          <div>
            <Input.TextArea
              value={noteDraft}
              autoFocus
              autoSize={{ minRows: 1, maxRows: 3 }}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault(); setEditingNoteCustomerId(null); setNoteDraft(''); return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveNote(r.id, noteDraft).then(() => { setEditingNoteCustomerId(null); setNoteDraft('') })
                }
              }}
              onBlur={() => saveNote(r.id, noteDraft).then(() => { setEditingNoteCustomerId(null); setNoteDraft('') })}
            />
            <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 11 }}>
              Enter 保存　Esc 取消　{isSaving ? '保存中...' : isSaved ? <span style={{ color: '#389e0d' }}>已自动保存</span> : ''}
            </div>
          </div>
        )
      }
    },
    {
      title: '下次跟进', width: 100,
      render: (_: unknown, r: Customer) => {
        const color = r.next_follow_up_status === 'overdue' ? '#a8071a' : '#003a8c'
        const isEditingNext = editingNextCustomerId === r.id
        const lines = followUpLabel(r).split('\n')
        if (isEditingNext) {
          return (
            <DatePicker
              open
              autoFocus
              value={r.next_follow_up ? dayjs(r.next_follow_up) : null}
              showTime={{
                format: 'HH:00',
                disabledTime: () => ({
                  disabledMinutes: () => Array.from({ length: 59 }, (_, i) => i + 1),
                }),
              }}
              format="YYYY-MM-DD HH:00"
              style={{ width: 150 }}
              onChange={async (val) => {
                await saveFollowUp(r.id, val ? dayjs(val).startOf('hour').toISOString() : null, r.note)
                setEditingNextCustomerId(null)
              }}
              onOpenChange={(open) => {
                if (!open) setEditingNextCustomerId(null)
              }}
            />
          )
        }
        return (
          <button
            onClick={() => setEditingNextCustomerId(r.id)}
            style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
          >
            <div>
              <div style={{ color, fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{lines[0]}</div>
              <div style={{ color, fontSize: 11, lineHeight: 1.2 }}>{lines[1] || ''}</div>
            </div>
          </button>
        )
      }
    },
    { title: '咨询次数', width: 80, render: (_: unknown, r: Customer) => <Select size='small' value={r.consultation_count ?? undefined} style={{ width: 60 }} placeholder='—' disabled={r.consultation_count === null} options={Array.from({ length: 21 }, (_, i) => ({ value: i, label: `${i}` }))} onChange={async (val) => { await api.put(`/sales/customers/${r.id}`, { consultation_count: val }); fetchCustomers() }} /> },
    { title: '绑定微信', width: 90, dataIndex: 'link_account_name', render: (v: string | null) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v || '-'}</span> },
  ]

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: '#595959' }}>我的微信号</div>
          <Button onClick={() => { addWechatForm.resetFields(); setAddWechatOpen(true) }}>+ 新增微信号</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type={selectedLA === null ? 'primary' : 'default'} onClick={() => setSelectedLA(null)}>
            全部
            <span style={{ marginLeft: 6, fontSize: 11, color: selectedLA === null ? '#1D4ED8' : '#8E8E8E' }}>{totalCustomers}</span>
          </Button>
          {linkAccounts.map((la) => (
            <button key={la.id} onClick={() => setSelectedLA(la.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${selectedLA === la.id ? '#BFDBFE' : '#D9D9D9'}`, background: selectedLA === la.id ? '#EAF2FF' : '#fff', cursor: 'pointer' }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: la.is_active ? '#16A34A' : '#BFBFBF' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#111827' }}>{la.account_id}</span>
              <span style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', borderRadius: 10, color: selectedLA === la.id ? '#1D4ED8' : '#6B7280', background: selectedLA === la.id ? '#DBEAFE' : '#F3F4F6' }}>{la.customer_count}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ color: '#595959', fontSize: 13, marginBottom: 8 }}>已购课程标签的 6 种状态</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 10 }}>
          {([
            'purchased_not_started',
            'sales_marked_completed',
            'admin_marked_completed',
            'purchased_not_started_refunded',
            'sales_marked_completed_refunded',
            'admin_marked_completed_refunded',
          ] as CourseStatusKey[]).map((key) => {
            const meta = COURSE_STATUS_META[key]
            const active = selectedStatusFilter === key
            const isRefunded = key.includes('refunded')
            return (
              <button
                key={key}
                onClick={() => setSelectedStatusFilter(key)}
                style={{
                  textAlign: 'left',
                  borderRadius: 6,
                  border: `1px solid ${active ? '#3B82F6' : meta.border}`,
                  background: '#fff',
                  color: '#595959',
                  padding: '8px 10px',
                  cursor: salesStatusSet.has(key) ? 'pointer' : 'not-allowed',
                  opacity: salesStatusSet.has(key) ? 1 : 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 4, padding: '1px 8px', fontSize: 12, textDecoration: isRefunded ? 'line-through' : 'none' }}>
                  电商管理课
                </span>
                <span style={{ fontSize: 12, color: '#595959', textDecoration: isRefunded ? 'line-through' : 'none' }}>{meta.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div><h2 style={{ marginBottom: 2 }}>我的客户</h2><div style={{ color: '#8c8c8c', fontSize: 12 }}>当前筛选共 {customers.length} 个客户</div></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Input.Search placeholder='搜索客户名/标签/备注' style={{ width: 260 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={() => fetchCustomers()} />
          <Button>批量导入</Button>
          <Button type='primary'>+ 新建客户</Button>
        </div>
      </div>

      <Table
        rowKey='id'
        dataSource={customers}
        columns={columns}
        loading={loading}
        pagination={false}
        size='small'
        tableLayout='fixed'
      />

      <Modal title='新增微信号' open={addWechatOpen} onOk={submitAddWechat} onCancel={() => setAddWechatOpen(false)}>
        <Form form={addWechatForm} layout='vertical'>
          <Form.Item name='account_id' label='微信号' rules={[{ required: true, message: '请输入微信号' }]}>
            <Input placeholder='例如 maoke_1234' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title='添加标签' open={!!tagTarget} onOk={addTag} onCancel={() => { setTagTarget(null); setSelectedTag(null) }}>
        <Select value={selectedTag} onChange={setSelectedTag} style={{ width: '100%' }} placeholder='搜索并选择标签' showSearch optionFilterProp='label'>
          {tagOptions.map((t) => (
            <Select.Option key={t.id} value={t.id} label={t.name}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: t.color, marginRight: 6 }} />
              {t.name}
              <span style={{ color: '#B8B8B8', fontSize: 10, marginLeft: 6 }}>{t.category_name}</span>
            </Select.Option>
          ))}
        </Select>
      </Modal>

      <Modal title='新增已购课程' open={!!courseTarget} onOk={addCourse} onCancel={() => { setCourseTarget(null); setSelectedProductId(null); setNewCourseAmount(null) }}>
        <div style={{ display: 'grid', gap: 10 }}>
        <Select value={selectedProductId} onChange={(v) => {
          setSelectedProductId(v)
          const p = productOptions.find((item) => item.id === v)
          setNewCourseAmount(p?.price ?? null)
        }} style={{ width: '100%' }} placeholder='选择课程'>
          {productOptions.filter((p) => p.status === 'active').map((p) => (
            <Select.Option key={p.id} value={p.id}>{p.name}（{y2f(p.price)}）</Select.Option>
          ))}
        </Select>
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          addonBefore='实付金额(元)'
          value={newCourseAmount === null ? null : newCourseAmount / 100}
          onChange={(v) => setNewCourseAmount(v === null ? null : Math.round(Number(v) * 100))}
        />
        </div>
      </Modal>

      <Modal
        title='修改实付金额'
        open={!!editingAmountCourse}
        confirmLoading={courseActionLoadingKey?.endsWith(':amount')}
        onOk={async () => {
          if (!editingAmountCourse) return
          const values = await amountForm.validateFields()
          await updateCourseAmount(editingAmountCourse.customerId, editingAmountCourse.enrollmentId, Math.round(values.amount_yuan * 100))
          setEditingAmountCourse(null)
          amountForm.resetFields()
        }}
        onCancel={() => { setEditingAmountCourse(null); amountForm.resetFields() }}
      >
        <Form form={amountForm} layout='vertical'>
          <Form.Item name='amount_yuan' label='实付金额(元)' rules={[{ required: true, message: '请输入实付金额' }, { type: 'number', min: 0, message: '金额不能小于0' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title='课程退款'
        open={!!editingRefundCourse}
        confirmLoading={courseActionLoadingKey?.endsWith(':refund')}
        onOk={async () => {
          if (!editingRefundCourse) return
          const values = await refundForm.validateFields()
          const refundCents = Math.round(values.refund_yuan * 100)
          if (refundCents > editingRefundCourse.maxRefund) {
            message.error('退款金额不能超过可退金额')
            return
          }
          await refundCourse(editingRefundCourse.customerId, editingRefundCourse.enrollmentId, refundCents)
          setEditingRefundCourse(null)
          refundForm.resetFields()
        }}
        onCancel={() => { setEditingRefundCourse(null); refundForm.resetFields() }}
      >
        <Form form={refundForm} layout='vertical'>
          <Form.Item name='refund_yuan' label='退款金额(元)' rules={[{ required: true, message: '请输入退款金额' }, { type: 'number', min: 0.01, message: '退款金额必须大于0' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            最多可退：{editingRefundCourse ? y2f(editingRefundCourse.maxRefund) : '¥0.00'}
          </div>
        </Form>
      </Modal>
    </div>
  )
}
