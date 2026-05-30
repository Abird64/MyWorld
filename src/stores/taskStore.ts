import { create } from 'zustand';
import type { Task, CreateTaskInput, UpdateTaskInput, CompleteResult } from '@/types/task';
import * as taskService from '@/services/taskService';
import { triggerSync } from '@/stores/syncStore';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;

  // 操作
  fetchTasks: (status?: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string, cascade?: boolean) => Promise<void>;
  completeTask: (id: string) => Promise<CompleteResult>;
  uncompleteTask: (id: string) => Promise<void>;
  searchTasks: (query: string) => Promise<Task[]>;
  fetchSubtasks: (parentId: string) => Promise<Task[]>;

  // 筛选
  filter: string;
  setFilter: (filter: string) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  isLoading: false,
  error: null,
  filter: 'all',

  fetchTasks: async (status?: string) => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await taskService.listTasks(
        status ? { status } : undefined
      );
      set({ tasks, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createTask: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const task = await taskService.createTask(input);
      set((state) => ({
        tasks: [task, ...state.tasks],
        isLoading: false,
      }));
      triggerSync();
      return task;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  updateTask: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const task = await taskService.updateTask(id, input);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        isLoading: false,
      }));
      triggerSync();
      return task;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  deleteTask: async (id, cascade = false) => {
    set({ isLoading: true, error: null });
    try {
      await taskService.deleteTask(id, cascade);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        isLoading: false,
      }));
      triggerSync();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  completeTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const result = await taskService.completeTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? { ...t, status: 'completed' as const, xp_earned: result.xp_earned }
            : t
        ),
        isLoading: false,
      }));
      triggerSync();
      return result;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  uncompleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await taskService.uncompleteTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? { ...t, status: 'pending' as const, xp_earned: 0, completed_at: null }
            : t
        ),
        isLoading: false,
      }));
      triggerSync();
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  searchTasks: async (query) => {
    try {
      return await taskService.searchTasks(query);
    } catch (e) {
      set({ error: String(e) });
      return [];
    }
  },

  fetchSubtasks: async (parentId) => {
    try {
      return await taskService.listSubtasks(parentId);
    } catch (e) {
      set({ error: String(e) });
      return [];
    }
  },

  setFilter: (filter) => set({ filter }),
}));
