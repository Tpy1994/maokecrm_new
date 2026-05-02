import { useEffect, useState } from 'react'
import { Modal, Form, Input, Space, Popconfirm, message, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { api } from '../../api/client'

interface TagCategory {
  id: string
  name: string
  group: string
  color: string
  sort_order: number
}

interface TagItem {
  id: string
  name: string
  tag_count: number
}

const COLORS = ['#0E0E0E', '#D4A27F', '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6', '#EC4899']

export default function TagsPage() {
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tagsMap, setTagsMap] = useState<Record<string, TagItem[]>>({})
  const [group, setGroup] = useState('sales')
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catEditing, setCatEditing] = useState<TagCategory | null>(null)
  const [catForm] = Form.useForm()
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagCategoryId, setTagCategoryId] = useState<string | null>(null)
  const [tagForm] = Form.useForm()

  const fetchCategories = async () => {
    const data = await api.get<TagCategory[]>('/tags/categories')
    setCategories(data)
    data.forEach((cat) => fetchTags(cat.id))
  }
  const fetchTags = async (catId: string) => {
    const data = await api.get<TagItem[]>(`/tags/categories/${catId}/tags`)
    setTagsMap((prev) => ({ ...prev, [catId]: data }))
  }
  useEffect(() => { fetchCategories() }, [])

  const filtered = categories.filter((c) => c.group === group)

  const handleCatSubmit = async () => {
    const values = await catForm.validateFields()
    try {
      catEditing
        ? await api.put(`/tags/categories/${catEditing.id}`, values)
        : await api.post('/tags/categories', { ...values, group })
      message.success(catEditing ? '分类已更新' : '分类已创建')
      setCatModalOpen(false); setCatEditing(null); catForm.resetFields(); fetchCategories()
    } catch { message.error('操作失败') }
  }

  const handleTagSubmit = async () => {
    if (!tagCategoryId) return
    const values = await tagForm.validateFields()
    try {
      await api.post(`/tags/categories/${tagCategoryId}/tags`, values)
      message.success('标签已创建')
      setTagModalOpen(false); setTagCategoryId(null); tagForm.resetFields(); fetchTags(tagCategoryId)
    } catch { message.error('操作失败') }
  }

  const setColor = async (catId: string, color: string) => {
    await api.put(`/tags/categories/${catId}`, { color }); fetchCategories()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>标签管理</h2>
          <p className="page-subtitle">分类决定标签颜色，一键调色全系统同步</p>
        </div>
        <Space>
          <Select value={group} onChange={setGroup} style={{ width: 130 }} options={[
            { value: 'sales', label: '销售标签' },
            { value: 'consultant', label: '咨询师标签' },
          ]} />
          <button
            onClick={() => { setCatEditing(null); catForm.resetFields(); setCatModalOpen(true) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8,
              border: 'none', background: '#0E0E0E', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#4A4A4A'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#0E0E0E'}
          >
            <PlusOutlined /> 新增分类
          </button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {filtered.map((cat) => (
          <div key={cat.id} style={{
            background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', padding: '18px 20px',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0E0E0E' }}>{cat.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={() => { setCatEditing(cat); catForm.setFieldsValue(cat); setCatModalOpen(true) }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8E8E8E', padding: '2px 6px', borderRadius: 4 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F2F2ED'; (e.currentTarget as HTMLElement).style.color = '#0E0E0E' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#8E8E8E' }}
                ><EditOutlined style={{ fontSize: 13 }} /></button>
                <Popconfirm title="删除分类将同时删除所有标签" onConfirm={async () => { await api.delete(`/tags/categories/${cat.id}`); fetchCategories() }}>
                  <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8E8E8E', padding: '2px 6px', borderRadius: 4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F2F2ED'; (e.currentTarget as HTMLElement).style.color = '#DC2626' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#8E8E8E' }}
                  ><DeleteOutlined style={{ fontSize: 13 }} /></button>
                </Popconfirm>
              </div>
            </div>

            {/* Color palette */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(cat.id, c)} style={{
                  width: 20, height: 20, borderRadius: 10, background: c,
                  border: cat.color === c ? '2px solid #0E0E0E' : '2px solid transparent',
                  cursor: 'pointer', padding: 0, transition: 'border 0.12s', outline: 'none',
                }} />
              ))}
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {(tagsMap[cat.id] || []).map((tag) => (
                <span key={tag.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 8px',
                  borderRadius: 4, background: cat.color + '14', color: cat.color,
                  border: '1px solid ' + cat.color + '26',
                }}>
                  {tag.name}
                  {tag.tag_count > 0 && <span style={{ opacity: 0.45, fontSize: 10 }}>{tag.tag_count}</span>}
                  <button onClick={async () => { await api.delete(`/tags/tags/${tag.id}`); fetchTags(cat.id) }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, fontSize: 12, lineHeight: 1 }}
                  >×</button>
                </span>
              ))}
              <button onClick={() => { setTagCategoryId(cat.id); tagForm.resetFields(); setTagModalOpen(true) }}
                style={{
                  border: '1px dashed #E8E8E3', background: 'none', cursor: 'pointer', color: '#8E8E8E',
                  fontSize: 11, padding: '2px 10px', borderRadius: 4, fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#D4A27F'; (e.currentTarget as HTMLElement).style.color = '#D4A27F' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E8E3'; (e.currentTarget as HTMLElement).style.color = '#8E8E8E' }}
              >
                + 新增标签
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal title={catEditing ? '编辑分类' : '新增分类'} open={catModalOpen} onOk={handleCatSubmit} onCancel={() => setCatModalOpen(false)} width={400}>
        <Form form={catForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
            <Input placeholder="如：行业类目" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新增标签" open={tagModalOpen} onOk={handleTagSubmit} onCancel={() => setTagModalOpen(false)} width={400}>
        <Form form={tagForm} layout="vertical">
          <Form.Item name="name" label="标签名称" rules={[{ required: true }]}>
            <Input placeholder="如：服装类" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
