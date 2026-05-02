import { useEffect, useState } from 'react'
import { Modal, Form, Input, Popconfirm, message, Select } from 'antd'
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

const COLOR_PALETTE = [
  { hex: '#3B82F6', label: '蓝色 — 中性参考（行业、来源）' },
  { hex: '#8B5CF6', label: '紫色 — 关系类（咨询师标签）' },
  { hex: '#EA580C', label: '橙色 — 重要程度（意向）' },
  { hex: '#22C55E', label: '绿色 — 积极状态（续费、长期）' },
  { hex: '#6B7280', label: '灰色 — 辅助分类' },
]

const GROUPS = [
  { key: 'sales', label: '销售标签', desc: '销售对客户打的标签，辅助销售跟进和客户分层' },
  { key: 'consultant', label: '咨询师标签', desc: '咨询师对客户打的标签，辅助咨询服务和学员管理' },
]

export default function TagsPage() {
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tagsMap, setTagsMap] = useState<Record<string, TagItem[]>>({})
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catEditing, setCatEditing] = useState<TagCategory | null>(null)
  const [modalGroup, setModalGroup] = useState('sales')
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

  const handleCatSubmit = async () => {
    const values = await catForm.validateFields()
    try {
      const payload = { ...values, group: catEditing ? catEditing.group : modalGroup }
      catEditing
        ? await api.put(`/tags/categories/${catEditing.id}`, payload)
        : await api.post('/tags/categories', payload)
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

  const renderGroup = (groupKey: string) => {
    const groupCats = categories.filter((c) => c.group === groupKey).sort((a, b) => a.sort_order - b.sort_order)

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {groupCats.map((cat) => (
          <div key={cat.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', padding: '18px 20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0E0E0E' }}>{cat.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={() => { setCatEditing(cat); setModalGroup(cat.group); catForm.setFieldsValue(cat); setCatModalOpen(true) }}
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
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(cat.id, c.hex)}
                  title={c.label}
                  style={{
                    width: 22, height: 22, borderRadius: 6, background: c.hex,
                    border: cat.color === c.hex ? '2px solid #0E0E0E' : '2px solid transparent',
                    cursor: 'pointer', padding: 0, transition: 'border 0.12s', outline: 'none',
                  }}
                />
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
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>标签管理</h2>
          <p className="page-subtitle">分类决定标签颜色，一键调色全系统同步</p>
        </div>
        <button
          onClick={() => { setCatEditing(null); setModalGroup('sales'); catForm.resetFields(); setCatModalOpen(true) }}
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
      </div>

      {GROUPS.map((g) => (
        <div key={g.key} style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0E0E0E', margin: 0 }}>
              {g.label}
            </h3>
            <p style={{ fontSize: 12, color: '#8E8E8E', margin: '2px 0 0' }}>
              {g.desc}
            </p>
          </div>
          {renderGroup(g.key)}
        </div>
      ))}

      <Modal title={catEditing ? '编辑分类' : '新增分类'} open={catModalOpen} onOk={handleCatSubmit} onCancel={() => setCatModalOpen(false)} width={440}>
        <Form form={catForm} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="name" label="分类名称" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="如：行业类目" />
            </Form.Item>
            {!catEditing && (
              <Form.Item name="group" label="所属大组" style={{ flex: 1 }}>
                <Select value={modalGroup} onChange={setModalGroup}>
                  {GROUPS.map((g) => (
                    <Select.Option key={g.key} value={g.key}>{g.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )}
          </div>
          {catEditing && (
            <div style={{ fontSize: 12, color: '#8E8E8E', marginBottom: 8 }}>
              所属大组：{GROUPS.find((g) => g.key === catEditing.group)?.label || catEditing.group}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#8E8E8E' }}>
            颜色请在分类卡片上通过调色板选择
          </div>
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
