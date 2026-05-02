import { useEffect, useState } from 'react'
import { Table, Modal, Form, Input, Select, DatePicker, message, Tabs } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api } from '../../api/client'

interface UserItem {
  id: string
  name: string
  phone: string
  role: string
  status: string
  hired_at: string | null
  wechat_count: number
  customer_count: number
}

const roleLabel: Record<string, string> = { sales: '销售', consultant: '咨询师', admin: '管理员' }
const statusLabel: Record<string, string> = { active: '在岗', inactive: '已离职', abnormal: '异常' }

function formatDate(v: dayjs.Dayjs | null | undefined): string | null {
  if (!v) return null
  return v.format('YYYY-MM-DD')
}

export default function PersonnelPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const fetchUsers = async () => {
    setLoading(true)
    try { setUsers(await api.get<UserItem[]>('/users/')) } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const getFiltered = () => {
    if (activeTab === 'all') return users
    if (activeTab === 'former') return users.filter((u) => u.status === 'inactive')
    return users.filter((u) => u.role === activeTab && u.status !== 'inactive')
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        name: values.name,
        phone: values.phone,
        password: values.password,
        role: values.role,
        hired_at: formatDate(values.hired_at),
      }
      if (editing) {
        const updateData: Record<string, unknown> = {
          name: values.name,
          phone: values.phone,
          role: values.role,
          status: values.status,
          hired_at: formatDate(values.hired_at),
        }
        if (values.password) updateData.password = values.password
        await api.put(`/users/${editing.id}`, updateData)
        message.success('已更新')
      } else {
        await api.post('/users/', payload)
        message.success('已创建')
      }
      setModalOpen(false); setEditing(null); form.resetFields(); fetchUsers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: '姓名',
      key: 'name',
      width: 180,
      render: (_: unknown, r: UserItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, color: '#0E0E0E' }}>{r.name}</span>
          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: '#F2F2ED', color: '#8E8E8E' }}>
            {roleLabel[r.role]}
          </span>
        </div>
      ),
    },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '账号数', dataIndex: 'wechat_count', width: 80 },
    { title: '客户数', dataIndex: 'customer_count', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="status-dot" style={{ background: v === 'active' ? '#16A34A' : v === 'abnormal' ? '#D97706' : '#B8B8B8' }} />
          <span style={{ fontSize: 12, color: '#4A4A4A' }}>{statusLabel[v]}</span>
        </span>
      ),
    },
    { title: '入职日期', dataIndex: 'hired_at', width: 110, render: (v: string | null) => v || '-' },
    {
      title: '',
      key: 'actions', width: 60,
      render: (_: unknown, r: UserItem) => (
        <button className="action-link" style={{ color: '#8E8E8E' }} onClick={() => {
          setEditing(r); form.setFieldsValue({ ...r, password: undefined, hired_at: r.hired_at ? dayjs(r.hired_at) : undefined }); setModalOpen(true)
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = '#0E0E0E'}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = '#8E8E8E'}
        >编辑</button>
      ),
    },
  ]

  const tabItems = [
    { key: 'all', label: `全部（${users.length}）` },
    { key: 'sales', label: `销售（${users.filter((u) => u.role === 'sales' && u.status !== 'inactive').length}）` },
    { key: 'consultant', label: `咨询师（${users.filter((u) => u.role === 'consultant' && u.status !== 'inactive').length}）` },
    { key: 'former', label: `已离职（${users.filter((u) => u.status === 'inactive').length}）` },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>人员管理</h2>
          <p className="page-subtitle">管理销售、咨询师和管理员账号</p>
        </div>
        <button
          onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: 'sales', status: 'active' }); setModalOpen(true) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8,
            border: 'none', background: '#0E0E0E', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#4A4A4A'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#0E0E0E'}
        >
          <PlusOutlined /> 新增人员
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', overflow: 'hidden' }}>
        <div style={{ padding: '8px 20px 0' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </div>
        <Table rowKey="id" dataSource={getFiltered()} columns={columns} loading={loading} pagination={false} />
      </div>

      <Modal
        title={editing ? '编辑人员' : '新增人员'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null) }}
        confirmLoading={submitting}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="name" label="姓名" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="phone" label="手机号" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item>
          </div>
          <Form.Item name="password" label={editing ? '新密码（留空不修改）' : '密码'} rules={editing ? [] : [{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="role" label="角色" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>
                <Select.Option value="sales">销售</Select.Option>
                <Select.Option value="consultant">咨询师</Select.Option>
                <Select.Option value="admin">管理员</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1 }}>
              <Select>
                <Select.Option value="active">在岗</Select.Option>
                <Select.Option value="inactive">已离职</Select.Option>
                <Select.Option value="abnormal">产能异常</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="hired_at" label="入职日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择入职日期" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
