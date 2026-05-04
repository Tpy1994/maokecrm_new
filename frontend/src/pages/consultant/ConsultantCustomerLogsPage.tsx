import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Modal, message } from 'antd'
import dayjs from 'dayjs'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'

interface LogItem {
  id: string
  customer_id: string
  consultant_id: string
  consultant_name: string
  is_me: boolean
  editable: boolean
  log_date: string
  duration: number
  summary: string | null
  content: string | null
  created_at: string
  updated_at: string
}

export default function ConsultantCustomerLogsPage() {
  const { customerId = '' } = useParams()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<LogItem | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const fetchLogs = async () => {
    setLoading(true)
    try {
      setLogs(await api.get<LogItem[]>(`/consultant/customers/${customerId}/consultation-logs`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (customerId) fetchLogs() }, [customerId])

  const submit = async () => {
    const v = await form.validateFields()
    const payload = {
      log_date: dayjs(v.log_date).format('YYYY-MM-DD'),
      duration: v.duration,
      summary: v.summary ?? null,
      content: v.content ?? null,
    }
    if (editing) await api.put(`/consultant/logs/${editing.id}`, payload)
    else await api.post(`/consultant/customers/${customerId}/logs`, payload)
    message.success('已保存')
    setEditing(null)
    setOpen(false)
    form.resetFields()
    fetchLogs()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>客户咨询详情</h2>
          <p className="page-subtitle">按时间倒序展示，咨询师可编辑自己的记录</p>
        </div>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>新增日志</Button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e3', borderRadius: 10, padding: 16 }}>
        {loading ? '加载中...' : logs.map((l) => (
          <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{l.log_date} · {l.duration} 分钟</strong>
              <span>{l.consultant_name}{l.is_me ? '（我）' : ''}</span>
            </div>
            <div style={{ marginTop: 4, color: '#595959' }}>{l.summary || '—'}</div>
            <div style={{ marginTop: 4, color: '#8c8c8c', whiteSpace: 'pre-wrap' }}>{l.content || ''}</div>
            {l.editable && (
              <Button size="small" style={{ marginTop: 8 }} onClick={() => { setEditing(l); form.setFieldsValue({ log_date: dayjs(l.log_date), duration: l.duration, summary: l.summary, content: l.content }); setOpen(true) }}>
                编辑
              </Button>
            )}
          </div>
        ))}
      </div>

      <Modal title={editing ? '编辑日志' : '新增日志'} open={open} onOk={submit} onCancel={() => { setOpen(false); setEditing(null) }} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="log_date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="duration" label="时长（分钟）" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
