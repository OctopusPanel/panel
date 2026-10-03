export type UiSlotType =
  | 'sidebar:user:nav'
  | 'sidebar:admin:nav'
  | 'server:tabs'
  | 'server:overview:widgets'
  | 'dashboard:widgets'
  | 'admin:overview:widgets';

export interface UiSlotItem {
  id: string;
  slot: UiSlotType;
  title: string;
  icon?: string;
  component: string | unknown;
  order?: number;
  route?: string;
  props?: Record<string, unknown>;
  permissions?: string[];
}

export class UiSlotRegistry {
  private slots = new Map<string, UiSlotItem>();

  register(item: UiSlotItem): void {
    this.slots.set(item.id, {
      ...item,
      order: item.order ?? 100,
    });
  }

  unregister(id: string): void {
    this.slots.delete(id);
  }

  getBySlot(slot: UiSlotType): UiSlotItem[] {
    return Array.from(this.slots.values())
      .filter((item) => item.slot === slot)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  getAll(): UiSlotItem[] {
    return Array.from(this.slots.values());
  }

  clear(): void {
    this.slots.clear();
  }
}

export const globalUiSlots = new UiSlotRegistry();
