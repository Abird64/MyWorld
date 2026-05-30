import { create } from 'zustand';
import type { Contact, CreateContactInput, UpdateContactInput } from '@/types/contact';
import * as contactService from '@/services/contactService';
import { triggerSync } from '@/stores/syncStore';

interface ContactState {
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;

  // 操作
  fetchContacts: (group_name?: string) => Promise<void>;
  createContact: (input: CreateContactInput) => Promise<Contact>;
  updateContact: (id: string, input: UpdateContactInput) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  searchContacts: (query: string) => Promise<Contact[]>;
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [],
  isLoading: false,
  error: null,

  fetchContacts: async (group_name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const contacts = await contactService.listContacts(
        group_name ? { group_name } : undefined
      );
      set({ contacts, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createContact: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const contact = await contactService.createContact(input);
      set((state) => ({
        contacts: [contact, ...state.contacts],
        isLoading: false,
      }));
      triggerSync();
      return contact;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  updateContact: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const contact = await contactService.updateContact(id, input);
      set((state) => ({
        contacts: state.contacts.map((c) => (c.id === id ? contact : c)),
        isLoading: false,
      }));
      triggerSync();
      return contact;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  deleteContact: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await contactService.deleteContact(id);
      set((state) => ({
        contacts: state.contacts.filter((c) => c.id !== id),
        isLoading: false,
      }));
      triggerSync();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  searchContacts: async (query) => {
    try {
      return await contactService.searchContacts(query);
    } catch (e) {
      set({ error: String(e) });
      return [];
    }
  },
}));
