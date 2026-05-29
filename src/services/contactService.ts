/**
 * 联系人服务 - 封装所有联系人相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ListContactsInput,
} from '@/types/contact';

/** 创建联系人 */
export async function createContact(input: CreateContactInput): Promise<Contact> {
  return tauriInvoke<Contact>('create_contact', { input });
}

/** 获取单个联系人 */
export async function getContact(id: string): Promise<Contact> {
  return tauriInvoke<Contact>('get_contact', { id });
}

/** 列出联系人 */
export async function listContacts(input?: ListContactsInput): Promise<Contact[]> {
  return tauriInvoke<Contact[]>('list_contacts', { input: input ?? null });
}

/** 更新联系人 */
export async function updateContact(
  id: string,
  input: UpdateContactInput
): Promise<Contact> {
  return tauriInvoke<Contact>('update_contact', { id, input });
}

/** 删除联系人 */
export async function deleteContact(
  id: string
): Promise<{ success: boolean; deleted: number }> {
  return tauriInvoke('delete_contact', { input: { id } });
}

/** 搜索联系人 */
export async function searchContacts(query: string): Promise<Contact[]> {
  return tauriInvoke<Contact[]>('search_contacts', { input: { query } });
}

export interface BirthdayInfo {
  contact_id: string;
  name: string;
  birthday_year: number | null;
  birthday_month: number;
  birthday_day: number;
  birthday_calendar: string;
  upcoming_date: string;
  upcoming_month: number;
  upcoming_day: number;
  upcoming_age: number | null;
  days_remaining: number;
}

/** 获取近期生日 */
export async function listUpcomingBirthdays(daysAhead?: number): Promise<BirthdayInfo[]> {
  return tauriInvoke<BirthdayInfo[]>('list_upcoming_birthdays', { days_ahead: daysAhead ?? 30 });
}

/** 获取所有生日 */
export async function listAllBirthdays(): Promise<BirthdayInfo[]> {
  return tauriInvoke<BirthdayInfo[]>('list_all_birthdays');
}
