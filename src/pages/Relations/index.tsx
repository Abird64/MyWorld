import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Trash2, Phone, MessageCircle, AtSign, Globe, Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { NavBar, CapsuleTabs } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { BirthdayBar } from '@/components/relations/BirthdayBar';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useContactStore } from '@/stores/contactStore';
import type { Contact, ContactMethodInput } from '@/types/contact';

const categories = [
  { id: 'all', label: '全部' },
  { id: 'family', label: '家人' },
  { id: 'friend', label: '朋友' },
  { id: 'classmate', label: '同学' },
  { id: 'colleague', label: '同事' },
  { id: 'teacher', label: '老师' },
];

/** 分组名映射：前端 id → DB group_name */
const groupIdToLabel: Record<string, string> = {
  family: '家人',
  friend: '朋友',
  classmate: '同学',
  colleague: '同事',
  teacher: '老师',
};

/** 头像色板（按分组固定颜色 — 柔和协调） */
const groupColors: Record<string, string> = {
  family: '#C17F59',
  friend: '#D4A84B',
  classmate: '#6B8BA4',
  colleague: '#5A9468',
  teacher: '#3478A0',
};

/** 计算指定年月的天数 */
function daysInMonth(year: string, month: string): number {
  if (!month) return 31;
  const m = parseInt(month);
  if (m === 2) {
    const y = year ? parseInt(year) : 2024;
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

function formatBirthday(calendar: string | null, year: number | null, month: number | null, day: number | null): string {
  if (!month || !day) return '';
  const cal = calendar === 'lunar' ? '农历' : '阳历';
  const parts: string[] = [];
  if (year) parts.push(year + '年');
  parts.push(month + '月' + day + '日');
  return cal + ' ' + parts.join('');
}


const METHOD_TYPES: { id: string; label: string; icon: typeof Phone }[] = [
  { id: 'phone', label: '电话', icon: Phone },
  { id: 'wechat', label: '微信', icon: MessageCircle },
  { id: 'qq', label: 'QQ', icon: MessageCircle },
  { id: 'email', label: '邮箱', icon: AtSign },
  { id: 'other', label: '其他', icon: Globe },
];

function getMethodIcon(type: string) {
  return METHOD_TYPES.find((m) => m.id === type)?.icon ?? Globe;
}

function getMethodLabel(type: string): string {
  return METHOD_TYPES.find((m) => m.id === type)?.label ?? type;
}

const TAG_SEP = ';;';

/** 分隔符分隔字符串 ↔ 数组（向后兼容旧的逗号分隔） */
function splitTags(s: string): string[] {
  if (s.includes(TAG_SEP)) {
    return s.split(TAG_SEP).map(v => v.trim()).filter(Boolean);
  }
  return s.split(/[,，]/).map(v => v.trim()).filter(Boolean);
}
function joinTags(arr: string[]): string {
  return arr.join(TAG_SEP);
}

/** 标签输入组件（提取到组件外部，避免每次渲染重建导致失焦） */
function TagInput({
  tags, onTagsChange, inputVal, onInputChange, placeholder, accentColor,
}: {
  tags: string[]; onTagsChange: (v: string[]) => void;
  inputVal: string; onInputChange: (v: string) => void;
  placeholder: string; accentColor: string;
}) {
  const appTheme = useAppTheme();
  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
              style={{ backgroundColor: `${withAlpha(accentColor, 0.15)}`, color: accentColor }}
            >
              {tag}
              <button
                onClick={() => onTagsChange(tags.filter((_, j) => j !== i))}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={inputVal}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && inputVal.trim()) {
            e.preventDefault();
            const val = inputVal.trim();
            if (!tags.includes(val)) onTagsChange([...tags, val]);
            onInputChange('');
          }
          if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
            onTagsChange(tags.slice(0, -1));
          }
        }}
        placeholder={placeholder}
        className="w-full text-base rounded-2xl px-4 py-3 focus:outline-none"
        style={{
          backgroundColor: `${withAlpha(accentColor, 0.06)}`,
          color: appTheme.ink,
        }}
      />
    </div>
  );
}

/** 联系方式行组件 */
function MethodRow({
  method, onChange, onRemove, textColor, bgColor,
}: {
  method: ContactMethodInput;
  onChange: (m: ContactMethodInput) => void;
  onRemove: () => void;
  textColor: string;
  bgColor: string;
}) {
  const Icon = getMethodIcon(method.method_type);
  return (
    <div className="flex items-center gap-2">
      <Select
        value={method.method_type}
        onChange={(v) => onChange({ ...method, method_type: v })}
        options={METHOD_TYPES.map((mt) => ({ value: mt.id, label: mt.label }))}
        className="flex-shrink-0"
      />
      <div className="flex-1 relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: `${withAlpha(textColor, 0.38)}` }} />
        <input
          type="text"
          value={method.value}
          onChange={(e) => onChange({ ...method, value: e.target.value })}
          placeholder="输入联系方式..."
          className="w-full text-base rounded-xl pl-8 pr-3 py-2.5 focus:outline-none"
          style={{ color: textColor, backgroundColor: bgColor }}
        />
      </div>
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
        title="移除"
      >
        <X size={14} style={{ color: `${withAlpha(textColor, 0.38)}` }} />
      </button>
    </div>
  );
}

export function RelationsPage() {
  const appTheme = useAppTheme();
  const { contacts, isLoading, fetchContacts, createContact, updateContact, deleteContact } = useContactStore();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 创建弹窗
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNicknames, setNewNicknames] = useState<string[]>([]);
  const [newNicknameInput, setNewNicknameInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newBirthdayCalendar, setNewBirthdayCalendar] = useState<'solar' | 'lunar'>('solar');
  const [newBirthdayYear, setNewBirthdayYear] = useState('');
  const [newBirthdayMonth, setNewBirthdayMonth] = useState('');
  const [newBirthdayDay, setNewBirthdayDay] = useState('');

  const createDaysInMonth = daysInMonth(newBirthdayYear, newBirthdayMonth);
  const [newContactMethods, setNewContactMethods] = useState<ContactMethodInput[]>([]);
  const [newNotes, setNewNotes] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);

  // 详情面板
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editNicknames, setEditNicknames] = useState<string[]>([]);
  const [editNicknameInput, setEditNicknameInput] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editBirthdayCalendar, setEditBirthdayCalendar] = useState<'solar' | 'lunar'>('solar');
  const [editBirthdayYear, setEditBirthdayYear] = useState('');
  const [editBirthdayMonth, setEditBirthdayMonth] = useState('');
  const [editBirthdayDay, setEditBirthdayDay] = useState('');
  const [editContactMethods, setEditContactMethods] = useState<ContactMethodInput[]>([]);
  const [editNotes, setEditNotes] = useState('');

  // Toast
  const [toast, setToast] = useState('');

  // 编辑模式
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandCreate, setExpandCreate] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (showCreate) {
      setTimeout(() => createInputRef.current?.focus(), 100);
    }
  }, [showCreate]);

  const filteredContacts = useMemo(() => {
    let list = activeCategory === 'all'
      ? contacts
      : contacts.filter((c) => c.group_name === groupIdToLabel[activeCategory]);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, activeCategory, searchQuery]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function resetCreateForm() {
    setNewName('');
    setNewNicknames([]);
    setNewNicknameInput('');
    setNewGroupName('');
    setNewBirthdayCalendar('solar');
    setNewBirthdayYear('');
    setNewBirthdayMonth('');
    setNewBirthdayDay('');
    setNewContactMethods([]);
    setNewNotes('');
    setExpandCreate(false);
  }

  async function handleCreate() {
    if (!newName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await createContact({
        name: newName.trim(),
        nickname: newNicknames.length > 0 ? joinTags(newNicknames) : undefined,
        group_name: newGroupName || undefined,
        birthday_calendar: newBirthdayCalendar || undefined,
        birthday_year: newBirthdayYear ? parseInt(newBirthdayYear) : undefined,
        birthday_month: newBirthdayMonth ? parseInt(newBirthdayMonth) : undefined,
        birthday_day: newBirthdayDay ? parseInt(newBirthdayDay) : undefined,
        contact_methods: newContactMethods.length > 0 ? newContactMethods : undefined,
        notes: newNotes.trim() || undefined,
      });
      setShowCreate(false);
      resetCreateForm();
      showToast('已添加');
    } catch (e) {
      showToast('添加失败，请重试');
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  }

  function openDetail(contact: Contact) {
    setSelectedContact(contact);
    setEditName(contact.name);
    setEditNicknames(contact.nickname ? splitTags(contact.nickname) : []);
    setEditNicknameInput('');
    setEditGroupName(contact.group_name || '');
    setEditBirthdayCalendar((contact.birthday_calendar as 'solar' | 'lunar') || 'solar');
    setEditBirthdayYear(contact.birthday_year ? String(contact.birthday_year) : '');
    setEditBirthdayMonth(contact.birthday_month ? String(contact.birthday_month) : '');
    setEditBirthdayDay(contact.birthday_day ? String(contact.birthday_day) : '');
    setEditContactMethods(
      contact.contact_methods?.map((m) => ({ method_type: m.method_type, value: m.value })) ?? []
    );
    setEditNotes(contact.notes || '');
    setIsEditing(false);
    setSaveStatus('idle');
  }

  function closeDetail() {
    setSelectedContact(null);
    setIsEditing(false);
    setSaveStatus('idle');
  }

  function handleEnterEdit() {
    setIsEditing(true);
    setSaveStatus('idle');
  }

  function handleCancelEdit() {
    if (selectedContact) {
      setEditName(selectedContact.name);
      setEditNicknames(selectedContact.nickname ? splitTags(selectedContact.nickname) : []);
      setEditGroupName(selectedContact.group_name || '');
      setEditBirthdayCalendar((selectedContact.birthday_calendar as 'solar' | 'lunar') || 'solar');
      setEditBirthdayYear(selectedContact.birthday_year ? String(selectedContact.birthday_year) : '');
      setEditBirthdayMonth(selectedContact.birthday_month ? String(selectedContact.birthday_month) : '');
      setEditBirthdayDay(selectedContact.birthday_day ? String(selectedContact.birthday_day) : '');
      setEditContactMethods(
        selectedContact.contact_methods?.map((m) => ({ method_type: m.method_type, value: m.value })) ?? []
      );
      setEditNotes(selectedContact.notes || '');
    }
    setIsEditing(false);
    setSaveStatus('idle');
  }

  async function handleSave() {
    if (!selectedContact || !editName.trim()) return;
    setSaveStatus('saving');
    try {
      await updateContact(selectedContact.id, {
        name: editName.trim(),
        nickname: editNicknames.length > 0 ? joinTags(editNicknames) : undefined,
        group_name: editGroupName || undefined,
        birthday_calendar: editBirthdayCalendar || undefined,
        birthday_year: editBirthdayYear ? parseInt(editBirthdayYear) : undefined,
        birthday_month: editBirthdayMonth ? parseInt(editBirthdayMonth) : undefined,
        birthday_day: editBirthdayDay ? parseInt(editBirthdayDay) : undefined,
        contact_methods: editContactMethods.length > 0 ? editContactMethods : undefined,
        notes: editNotes.trim() || undefined,
      });
      setSaveStatus('saved');
      setIsEditing(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setSaveStatus('error');
      showToast('保存失败，请重试');
      console.error(e);
    }
  }

  async function handleDelete() {
    if (!selectedContact) return;
    setShowDeleteConfirm(true);
  }

  async function executeDelete() {
    if (!selectedContact) return;
    try {
      await deleteContact(selectedContact.id);
      showToast('已删除');
      closeDetail();
    } catch (e) {
      showToast('删除失败，请重试');
      console.error(e);
    } finally {
      setShowDeleteConfirm(false);
    }
  }

  function getGroupColor(groupName: string | null): string {
    if (!groupName) return appTheme.primary;
    const entry = Object.entries(groupIdToLabel).find(([, label]) => label === groupName);
    return entry ? groupColors[entry[0]] : appTheme.primary;
  }

  return (
    <PageContainer className="relative" style={{ '--select-color': appTheme.ink, '--select-bg': appTheme.canvas } as React.CSSProperties}>
      <NavBar title="联系人" />

      {/* 固定控制区：搜索 + 生日 + 分类 */}
      <div className="flex-shrink-0 flex flex-col items-center px-4 sm:px-8 pt-4 pb-4 relative z-10">
        <div className="w-full max-w-[1000px] space-y-4">
          {/* 搜索栏 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: appTheme.inkMuted48 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索联系人"
              aria-label="搜索联系人"
              className="w-full text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none"
              style={{
                backgroundColor: `${withAlpha(appTheme.ink, 0.04)}`,
                color: appTheme.ink,
              }}
            />
          </div>

          <BirthdayBar />

          <CapsuleTabs
            items={categories}
            activeId={activeCategory}
            onChange={setActiveCategory}
            accentColor={appTheme.primary}
          />
        </div>
      </div>

      {/* 可滚动内容区：联系人列表 */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-8 pb-8 relative z-10">
        <div className="max-w-[1000px] mx-auto w-full">
          {isLoading && contacts.length === 0 ? (
            <div className="text-center py-20" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>
              加载中...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-20" style={{ color: `${withAlpha(appTheme.ink, 0.4)}` }}>
              {searchQuery.trim() ? '未找到匹配的联系人' : '暂无联系人'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => openDetail(contact)}
                  className="rounded-[18px] p-4 flex items-center gap-4 transition-colors cursor-pointer h-[110px] overflow-hidden"
                  style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}
                >
                  {/* 头像 */}
                  <div
                    className="w-[48px] h-[48px] rounded-full flex-shrink-0 flex items-center justify-center text-lg font-semibold text-white"
                    style={{ backgroundColor: getGroupColor(contact.group_name) }}
                  >
                    {contact.name.charAt(0)}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className=" text-lg truncate" style={{ color: appTheme.ink }}>
                        {contact.name}
                      </span>
                      {contact.nickname && (
                        <span className=" text-sm truncate" style={{ color: `${withAlpha(appTheme.ink, 0.33)}` }}>
                          ({splitTags(contact.nickname)[0]}{splitTags(contact.nickname).length > 1 ? '...' : ''})
                        </span>
                      )}
                    </div>
                    {contact.group_name && (
                      <span
                        className=" text-sm mt-1 px-2 py-0.5 rounded-full w-fit"
                        style={{
                          backgroundColor: `${withAlpha(getGroupColor(contact.group_name), 0.19)}`,
                          color: getGroupColor(contact.group_name),
                        }}
                      >
                        {contact.group_name}
                      </span>
                    )}
                    {contact.contact_methods && contact.contact_methods.length > 0 && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {contact.contact_methods.map((m) => {
                          const Icon = getMethodIcon(m.method_type);
                          return (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1 text-xs"
                              style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}
                            >
                              <Icon size={11} />
                              <span className="">{getMethodLabel(m.method_type)}</span>
                              <span className="truncate max-w-[100px]">{m.value}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {contact.notes && (
                      <span className=" text-sm mt-1 truncate" style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }}>
                        {contact.notes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右下角加号按钮 */}
      <button
        onClick={() => setShowCreate(true)}
        aria-label="添加联系人"
        className="fixed bottom-[72px] right-8 z-30 w-14 h-14 rounded-full text-white active:scale-95 transition-all flex items-center justify-center"
        style={{ backgroundColor: appTheme.primary }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* ========== 创建联系人弹窗 ========== */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-32">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setShowCreate(false); resetCreateForm(); }}
          />
          <div
            className="relative w-full max-w-[600px] rounded-[18px] p-8 mx-4"
            style={{ backgroundColor: appTheme.canvas }}
          >
            <input
              ref={createInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="姓名（必填）"
              className="w-full text-xl bg-transparent border-b pb-3 mb-5 focus:outline-none"
              style={{
                color: appTheme.ink,
                borderColor: newName ? appTheme.primary : `${withAlpha(appTheme.ink, 0.13)}`,
              }}
            />

            {/* 别称/昵称（多值） */}
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>别称 / 昵称</label>
              <TagInput
                tags={newNicknames}
                onTagsChange={setNewNicknames}
                inputVal={newNicknameInput}
                onInputChange={setNewNicknameInput}
                placeholder="输入后回车添加，可多个"
                accentColor={appTheme.primary}
              />
            </div>

            {/* 分组 */}
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>分组</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(groupIdToLabel).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setNewGroupName(newGroupName === label ? '' : label)}
                    className="px-3 py-1.5 rounded-full text-sm transition-all"
                    style={{
                      backgroundColor: newGroupName === label ? groupColors[id] : `${withAlpha(appTheme.ink, 0.06)}`,
                      color: newGroupName === label ? appTheme.onPrimary : `${withAlpha(appTheme.ink, 0.6)}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {!expandCreate && (
              <button
                onClick={() => setExpandCreate(true)}
                className="w-full py-2 text-sm transition-colors mb-4"
                style={{ color: appTheme.inkMuted48 }}
              >
                展开更多...
              </button>
            )}

            {expandCreate && (
            <>
            {/* 生日 */}
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>生日</label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 日历类型切换 */}
                <div className="flex rounded-lg overflow-hidden" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.03)}` }}>
                  <button
                    onClick={() => setNewBirthdayCalendar('solar')}
                    className="px-3 py-1.5 text-xs transition-colors"
                    style={{
                      backgroundColor: newBirthdayCalendar === 'solar' ? appTheme.primary : 'transparent',
                      color: newBirthdayCalendar === 'solar' ? appTheme.onPrimary : `${withAlpha(appTheme.ink, 0.38)}`,
                    }}
                  >阳历</button>
                  <button
                    onClick={() => setNewBirthdayCalendar('lunar')}
                    className="px-3 py-1.5 text-xs transition-colors"
                    style={{
                      backgroundColor: newBirthdayCalendar === 'lunar' ? appTheme.primary : 'transparent',
                      color: newBirthdayCalendar === 'lunar' ? appTheme.onPrimary : `${withAlpha(appTheme.ink, 0.38)}`,
                    }}
                  >农历</button>
                </div>
                {/* 年份（选填） */}
                <input
                  type="number"
                  value={newBirthdayYear}
                  onChange={(e) => setNewBirthdayYear(e.target.value)}
                  placeholder="年份"
                  min="1900" max="2100"
                  className="w-20 text-sm rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{ color: appTheme.ink, backgroundColor: `${withAlpha(appTheme.ink, 0.03)}` }}
                />
                <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.25)}` }}>年</span>
                {/* 月份 */}
                <Select
                  value={newBirthdayMonth}
                  onChange={(v) => {
                    setNewBirthdayMonth(v);
                    if (newBirthdayDay && v) {
                      const maxD = daysInMonth(newBirthdayYear, v);
                      if (parseInt(newBirthdayDay) > maxD) setNewBirthdayDay(String(maxD));
                    }
                  }}
                  placeholder="月"
                  options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                />
                <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.25)}` }}>月</span>
                {/* 日期 */}
                <Select
                  value={newBirthdayDay}
                  onChange={setNewBirthdayDay}
                  placeholder="日"
                  options={Array.from({ length: createDaysInMonth }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                />
                <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.25)}` }}>日</span>
              </div>
            </div>

            {/* 联系方式 */}
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }}>联系方式</label>
              <div className="space-y-2">
                {newContactMethods.map((m, i) => (
                  <MethodRow
                    key={i}
                    method={m}
                    onChange={(v) => {
                      const next = [...newContactMethods];
                      next[i] = v;
                      setNewContactMethods(next);
                    }}
                    onRemove={() => setNewContactMethods(newContactMethods.filter((_, j) => j !== i))}
                    textColor={appTheme.ink}
                    bgColor={`${withAlpha(appTheme.ink, 0.03)}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setNewContactMethods([...newContactMethods, { method_type: 'phone', value: '' }])}
                className="mt-2 text-sm flex items-center gap-1 transition-colors hover:opacity-80"
                style={{ color: appTheme.primary }}
              >
                <Plus size={14} /> 添加联系方式
              </button>
            </div>

            {/* 备注 */}
            <div className="mb-6">
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="备注..."
                rows={2}
                className="w-full text-base rounded-2xl px-4 py-3 focus:outline-none resize-none"
                style={{
                  backgroundColor: `${withAlpha(appTheme.ink, 0.03)}`,
                  color: appTheme.ink,
                }}
              />
            </div>

            </>
            )}

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); resetCreateForm(); }}
                className="flex-1 py-3 rounded-full transition-colors"
                style={{ color: `${withAlpha(appTheme.ink, 0.5)}`, backgroundColor: `${withAlpha(appTheme.ink, 0.06)}` }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-full text-white transition-colors disabled:opacity-30"
                style={{ backgroundColor: appTheme.primary }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 联系人详情面板 ========== */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDetail}
          />
          {/* 详情面板 */}
          <div
            className="relative w-full max-w-[480px] flex flex-col animate-slide-in"
            style={{ backgroundColor: appTheme.canvas }}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${withAlpha(appTheme.ink, 0.08)}` }}>
              <div className="flex items-center gap-3">
                <h2 className="text-xl " style={{ color: appTheme.ink }}>联系人详情</h2>
                {saveStatus === 'saving' && (
                  <span className="text-xs" style={{ color: appTheme.inkMuted48 }}>保存中...</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-xs" style={{ color: '#4CAF76' }}>已保存</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-xs" style={{ color: appTheme.danger }}>保存失败</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button
                    onClick={handleEnterEdit}
                    className="px-4 py-2 rounded-full text-sm transition-colors"
                    style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
                  >
                    编辑
                  </button>
                )}
                <button
                  onClick={closeDetail}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-colors"
                  style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.08)}` }}
                >
                  <X size={16} style={{ color: `${withAlpha(appTheme.ink, 0.6)}` }} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {!isEditing && (
                <>
                  {/* 头像预览 */}
                  <div className="flex justify-center">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white"
                      style={{ backgroundColor: getGroupColor(selectedContact.group_name) }}
                    >
                      {selectedContact.name.charAt(0)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>姓名</label>
                    <p className="text-lg" style={{ color: appTheme.ink }}>{selectedContact.name}</p>
                  </div>

                  {selectedContact.nickname && splitTags(selectedContact.nickname).length > 0 && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>别称 / 昵称</label>
                      <div className="flex flex-wrap gap-2">
                        {splitTags(selectedContact.nickname).map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                            style={{ backgroundColor: `${withAlpha(appTheme.primary, 0.15)}`, color: appTheme.primary }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContact.group_name && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>分组</label>
                      <span className="px-3 py-1 rounded-full text-sm"
                        style={{ backgroundColor: `${withAlpha(getGroupColor(selectedContact.group_name), 0.19)}`, color: getGroupColor(selectedContact.group_name) }}>
                        {selectedContact.group_name}
                      </span>
                    </div>
                  )}

                  {(selectedContact.birthday_month && selectedContact.birthday_day) ? (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>生日</label>
                      <p className="text-base" style={{ color: appTheme.ink }}>
                        {formatBirthday(selectedContact.birthday_calendar || null, selectedContact.birthday_year ?? null, selectedContact.birthday_month ?? null, selectedContact.birthday_day ?? null)}
                      </p>
                    </div>
                  ) : null}

                  {selectedContact.contact_methods && selectedContact.contact_methods.length > 0 && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>联系方式</label>
                      <div className="space-y-2">
                        {selectedContact.contact_methods.map((m) => {
                          const Icon = getMethodIcon(m.method_type);
                          return (
                            <div key={m.id} className="flex items-center gap-2 text-sm" style={{ color: appTheme.ink }}>
                              <Icon size={14} style={{ color: `${withAlpha(appTheme.ink, 0.5)}` }} />
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.06)}`, color: appTheme.inkMuted80 }}>
                                {getMethodLabel(m.method_type)}
                              </span>
                              <span>{m.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedContact.notes && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>备注</label>
                      <p className="text-sm leading-relaxed" style={{ color: `${withAlpha(appTheme.ink, 0.7)}` }}>{selectedContact.notes}</p>
                    </div>
                  )}
                </>
              )}

              {isEditing && (
                <>
              {/* 头像预览 */}
              <div className="flex justify-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white"
                  style={{ backgroundColor: getGroupColor(editGroupName || selectedContact.group_name) }}
                >
                  {editName.charAt(0) || selectedContact.name.charAt(0)}
                </div>
              </div>

              {/* 姓名 */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>姓名</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-lg rounded-2xl px-4 py-3 focus:outline-none"
                  style={{ color: appTheme.ink, backgroundColor: `${withAlpha(appTheme.ink, 0.03)}` }}
                />
              </div>

              {/* 别称/昵称（多值） */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>别称 / 昵称</label>
                <TagInput
                  tags={editNicknames}
                  onTagsChange={setEditNicknames}
                  inputVal={editNicknameInput}
                  onInputChange={setEditNicknameInput}
                  placeholder="输入后回车添加"
                  accentColor={appTheme.primary}
                />
              </div>

              {/* 分组 */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>分组</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(groupIdToLabel).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setEditGroupName(editGroupName === label ? '' : label)}
                      className="px-4 py-1.5 rounded-full text-sm transition-all"
                      style={{
                        backgroundColor: editGroupName === label ? groupColors[id] : `${withAlpha(appTheme.ink, 0.06)}`,
                        color: editGroupName === label ? appTheme.onPrimary : `${withAlpha(appTheme.ink, 0.6)}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 生日 */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>生日</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 日历类型切换 */}
                  <div className="flex rounded-lg overflow-hidden" style={{ backgroundColor: `${withAlpha(appTheme.ink, 0.03)}` }}>
                    <button
                      onClick={() => setEditBirthdayCalendar('solar')}
                      className="px-3 py-1.5 text-xs transition-colors"
                      style={{
                        backgroundColor: editBirthdayCalendar === 'solar' ? appTheme.primary : 'transparent',
                        color: editBirthdayCalendar === 'solar' ? appTheme.onPrimary : `${withAlpha(appTheme.ink, 0.38)}`,
                      }}
                    >阳历</button>
                    <button
                      onClick={() => setEditBirthdayCalendar('lunar')}
                      className="px-3 py-1.5 text-xs transition-colors"
                      style={{
                        backgroundColor: editBirthdayCalendar === 'lunar' ? appTheme.primary : 'transparent',
                        color: editBirthdayCalendar === 'lunar' ? appTheme.onPrimary : `${withAlpha(appTheme.ink, 0.38)}`,
                      }}
                    >农历</button>
                  </div>
                  {/* 年份（选填） */}
                  <input
                    type="number"
                    value={editBirthdayYear}
                    onChange={(e) => setEditBirthdayYear(e.target.value)}
                    placeholder="年份"
                    min="1900" max="2100"
                    className="w-20 text-sm rounded-lg px-2 py-1.5 focus:outline-none"
                    style={{ color: appTheme.ink, backgroundColor: `${withAlpha(appTheme.ink, 0.03)}` }}
                  />
                  <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.25)}` }}>年</span>
                  {/* 月份 */}
                  <Select
                    value={editBirthdayMonth}
                    onChange={setEditBirthdayMonth}
                    placeholder="月"
                    options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  />
                  <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.25)}` }}>月</span>
                  {/* 日期 */}
                  <Select
                    value={editBirthdayDay}
                    onChange={setEditBirthdayDay}
                    placeholder="日"
                    options={Array.from({ length: daysInMonth(editBirthdayYear, editBirthdayMonth) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  />
                  <span className="text-sm" style={{ color: `${withAlpha(appTheme.ink, 0.25)}` }}>日</span>
                </div>
              </div>

              {/* 联系方式 */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>联系方式</label>
                <div className="space-y-2">
                  {editContactMethods.map((m, i) => (
                    <MethodRow
                      key={i}
                      method={m}
                      onChange={(v) => {
                        const next = [...editContactMethods];
                        next[i] = v;
                        setEditContactMethods(next);
                      }}
                      onRemove={() => setEditContactMethods(editContactMethods.filter((_, j) => j !== i))}
                      textColor={appTheme.ink}
                      bgColor={`${withAlpha(appTheme.ink, 0.03)}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setEditContactMethods([...editContactMethods, { method_type: 'phone', value: '' }])}
                  className="mt-2 text-sm flex items-center gap-1 transition-colors hover:opacity-80"
                  style={{ color: appTheme.primary }}
                >
                  <Plus size={14} /> 添加联系方式
                </button>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm mb-1.5" style={{ color: `${withAlpha(appTheme.ink, 0.38)}` }}>备注</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="备注..."
                  rows={3}
                  className="w-full text-base rounded-2xl px-4 py-3 focus:outline-none resize-none"
                  style={{ color: appTheme.ink, backgroundColor: `${withAlpha(appTheme.ink, 0.03)}` }}
                />
              </div>
                </>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${withAlpha(appTheme.ink, 0.08)}` }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 py-3 rounded-full transition-colors"
                    style={{ color: `${withAlpha(appTheme.ink, 0.5)}`, backgroundColor: `${withAlpha(appTheme.ink, 0.06)}` }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!editName.trim() || saveStatus === 'saving'}
                    className="flex-1 py-3 rounded-full text-white transition-colors disabled:opacity-30"
                    style={{ backgroundColor: appTheme.primary }}
                  >
                    {saveStatus === 'saving' ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleDelete}
                    className="px-5 py-3 rounded-full flex items-center gap-2 transition-colors"
                    style={{ color: appTheme.danger, backgroundColor: `${withAlpha(appTheme.danger, 0.13)}` }}
                  >
                    <Trash2 size={16} />
                    删除
                  </button>
                  <button
                    onClick={closeDetail}
                    className="flex-1 py-3 rounded-full transition-colors"
                    style={{ backgroundColor: appTheme.primary, color: appTheme.onPrimary }}
                  >
                    完成
                  </button>
                </>
              )}
            </div>
        </div>
      </div>
      )}

      {/* 删除确认 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowDeleteConfirm(false)}>
          <div className="rounded-2xl p-6 mx-4 w-[320px]" style={{ backgroundColor: appTheme.canvas }} onClick={(e) => e.stopPropagation()}>
            <p className="text-base mb-6" style={{ color: `${withAlpha(appTheme.ink, 0.7)}` }}>确定要删除 {selectedContact?.name} 吗？一旦删除，就不能回来了。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
                style={{ color: `${withAlpha(appTheme.ink, 0.5)}`, backgroundColor: `${withAlpha(appTheme.ink, 0.06)}` }}>
                取消
              </button>
              <button onClick={executeDelete}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-colors"
                style={{ backgroundColor: appTheme.danger, color: '#fff' }}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-black/80 text-white px-6 py-3 rounded-2xl text-sm max-w-[500px]" role="alert" aria-live="polite">
          {toast}
        </div>
      )}

    </PageContainer>
  );
}
