import { useEffect, useState } from 'react'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Form, Input, message, Modal, Popconfirm, Select } from 'antd'
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
  category_id?: string
  tag_count: number
}

interface EditingTag {
  categoryId: string
  tag: TagItem
}

const COLOR_PALETTE = [
  { hex: '#3B82F6', label: '蓝色' },
  { hex: '#8B5CF6', label: '紫色' },
  { hex: '#EA580C', label: '橙色' },
  { hex: '#22C55E', label: '绿色' },
  { hex: '#6B7280', label: '灰色' },
]

const GROUPS = [
  { key: 'sales', label: '销售标签', desc: '销售对客户打的标签，辅助跟进和客户分层' },
  { key: 'consultant', label: '咨询师标签', desc: '咨询师对客户打的标签，辅助服务和学员管理' },
]

const emptyMessage = '操作失败'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return emptyMessage
}

export default function TagsPage() {
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tagsMap, setTagsMap] = useState<Record<string, TagItem[]>>({})
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catEditing, setCatEditing] = useState<TagCategory | null>(null)
  const [modalGroup, setModalGroup] = useState('sales')
  const [catForm] = Form.useForm()
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagCategoryId, setTagCategoryId] = useState<string | null>(null)
  const [tagEditing, setTagEditing] = useState<EditingTag | null>(null)
  const [tagForm] = Form.useForm()

  const fetchTags = async (catId: string) => {
    const data = await api.get<TagItem[]>(`/tags/categories/${catId}/tags`)
    setTagsMap((prev) => ({ ...prev, [catId]: data }))
  }

  const fetchCategories = async () => {
    const data = await api.get<TagCategory[]>('/tags/categories')
    setCategories(data)
    setTagsMap({})
    await Promise.all(data.map((cat) => fetchTags(cat.id).catch(() => undefined)))
  }

  useEffect(() => {
    void fetchCategories()
  }, [])

  const openCreateCategory = () => {
    setCatEditing(null)
    setModalGroup('sales')
    catForm.resetFields()
    catForm.setFieldsValue({ group: 'sales' })
    setCatModalOpen(true)
  }

  const openEditCategory = (cat: TagCategory) => {
    setCatEditing(cat)
    setModalGroup(cat.group)
    catForm.setFieldsValue({ name: cat.name })
    setCatModalOpen(true)
  }

  const openCreateTag = (categoryId: string) => {
    setTagEditing(null)
    setTagCategoryId(categoryId)
    tagForm.resetFields()
    setTagModalOpen(true)
  }

  const openEditTag = (categoryId: string, tag: TagItem) => {
    setTagEditing({ categoryId, tag })
    setTagCategoryId(categoryId)
    tagForm.setFieldsValue({ name: tag.name })
    setTagModalOpen(true)
  }

  const handleCatSubmit = async () => {
    try {
      const values = await catForm.validateFields()
      const payload = { ...values, group: catEditing ? catEditing.group : values.group }
      if (catEditing) {
        await api.put(`/tags/categories/${catEditing.id}`, payload)
      } else {
        await api.post('/tags/categories', payload)
      }
      message.success(catEditing ? '分类已更新' : '分类已创建')
      setCatModalOpen(false)
      setCatEditing(null)
      catForm.resetFields()
      await fetchCategories()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error(getErrorMessage(error))
    }
  }

  const handleTagSubmit = async () => {
    try {
      const values = await tagForm.validateFields()
      if (tagEditing) {
        await api.put(`/tags/tags/${tagEditing.tag.id}`, values)
      } else {
        if (!tagCategoryId) return
        await api.post(`/tags/categories/${tagCategoryId}/tags`, values)
      }
      message.success(tagEditing ? '标签已更新' : '标签已创建')
      setTagModalOpen(false)
      setTagCategoryId(null)
      setTagEditing(null)
      tagForm.resetFields()
      await fetchCategories()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error(getErrorMessage(error))
    }
  }

  const setColor = async (catId: string, color: string) => {
    try {
      await api.put(`/tags/categories/${catId}`, { color })
      await fetchCategories()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const deleteCategory = async (catId: string) => {
    try {
      await api.delete(`/tags/categories/${catId}`)
      message.success('分类已删除')
      await fetchCategories()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const deleteTag = async (tagId: string) => {
    try {
      await api.delete(`/tags/tags/${tagId}`)
      message.success('标签已删除')
      await fetchCategories()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const renderGroup = (groupKey: string) => {
    const groupCats = categories
      .filter((c) => c.group === groupKey)
      .sort((a, b) => a.sort_order - b.sort_order)

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {groupCats.map((cat) => (
          <div key={cat.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E8E3', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0E0E0E' }}>{cat.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  type="button"
                  onClick={() => openEditCategory(cat)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8E8E8E', padding: '2px 6px', borderRadius: 4 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F2F2ED'; (e.currentTarget as HTMLElement).style.color = '#0E0E0E' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#8E8E8E' }}
                >
                  <EditOutlined style={{ fontSize: 13 }} />
                </button>
                <Popconfirm title="删除分类将同时删除所有标签" onConfirm={() => deleteCategory(cat.id)}>
                  <button
                    type="button"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8E8E8E', padding: '2px 6px', borderRadius: 4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F2F2ED'; (e.currentTarget as HTMLElement).style.color = '#DC2626' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#8E8E8E' }}
                  >
                    <DeleteOutlined style={{ fontSize: 13 }} />
                  </button>
                </Popconfirm>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(cat.id, c.hex)}
                  title={c.label}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: c.hex,
                    border: cat.color === c.hex ? '2px solid #0E0E0E' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'border 0.12s',
                    outline: 'none',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {(tagsMap[cat.id] || []).map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${cat.color}14`,
                    color: cat.color,
                    border: `1px solid ${cat.color}26`,
                  }}
                >
                  {tag.name}
                  {tag.tag_count > 0 && <span style={{ opacity: 0.45, fontSize: 10 }}>{tag.tag_count}</span>}
                  <button
                    type="button"
                    onClick={() => openEditTag(cat.id, tag)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, fontSize: 12, lineHeight: 1 }}
                    title="编辑标签"
                  >
                    <EditOutlined />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTag(tag.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, fontSize: 12, lineHeight: 1 }}
                    title="删除标签"
                  >
                    <DeleteOutlined />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => openCreateTag(cat.id)}
                style={{
                  border: '1px dashed #E8E8E3',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#8E8E8E',
                  fontSize: 11,
                  padding: '2px 10px',
                  borderRadius: 4,
                  fontFamily: 'inherit',
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
          type="button"
          onClick={openCreateCategory}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#0E0E0E',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
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
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0E0E0E', margin: 0 }}>{g.label}</h3>
            <p style={{ fontSize: 12, color: '#8E8E8E', margin: '2px 0 0' }}>{g.desc}</p>
          </div>
          {renderGroup(g.key)}
        </div>
      ))}

      <Modal title={catEditing ? '编辑分类' : '新增分类'} open={catModalOpen} onOk={handleCatSubmit} onCancel={() => setCatModalOpen(false)} width={440}>
        <Form form={catForm} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]} style={{ flex: 1 }}>
              <Input placeholder="例如：行业标签" />
            </Form.Item>
            {!catEditing && (
              <Form.Item name="group" label="所属大组" style={{ flex: 1 }} initialValue={modalGroup}>
                <Select onChange={setModalGroup} options={GROUPS.map((g) => ({ value: g.key, label: g.label }))} />
              </Form.Item>
            )}
          </div>
          {catEditing && (
            <div style={{ fontSize: 12, color: '#8E8E8E', marginBottom: 8 }}>
              所属大组：{GROUPS.find((g) => g.key === catEditing.group)?.label || catEditing.group}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#8E8E8E' }}>颜色请在分类卡片上通过调色板选择</div>
        </Form>
      </Modal>

      <Modal title={tagEditing ? '编辑标签' : '新增标签'} open={tagModalOpen} onOk={handleTagSubmit} onCancel={() => setTagModalOpen(false)} width={400}>
        <Form form={tagForm} layout="vertical">
          <Form.Item name="name" label="标签名称" rules={[{ required: true, message: '请输入标签名称' }]}>
            <Input placeholder="例如：服装类" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
