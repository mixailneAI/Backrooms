const SLOT_COUNT = 12;
const HOTBAR_COUNT = 3;
const STACKABLE = new Set(['water', 'food', 'spraycan']);
const VALID_TYPES = new Set(['water', 'note', 'food', 'spraycan', 'backpack']);

function copyItem(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: String(item.id || item.type || 'item'),
    type: String(item.type || ''),
    count: Math.max(1, Math.floor(Number(item.count) || 1)),
    data: item.data && typeof item.data === 'object' ? { ...item.data } : {}
  };
}

export function createInventory(save) {
  const slots = Array(SLOT_COUNT).fill(null);
  let activeIndex = 0;

  const saved = save && typeof save.getItem === 'function' ? save.getItem('inventory', null) : null;
  if (Array.isArray(saved)) {
    for (let i = 0; i < Math.min(SLOT_COUNT, saved.length); i++) {
      const item = copyItem(saved[i]);
      if (item && VALID_TYPES.has(item.type)) slots[i] = item;
    }
  }

  function persist() {
    if (save && typeof save.setItem === 'function') {
      save.setItem('inventory', slots.map(item => item ? copyItem(item) : null));
    }
  }

  function firstFree() {
    return slots.findIndex(item => item === null);
  }

  function add(rawItem) {
    const item = copyItem(rawItem);
    if (!item || !VALID_TYPES.has(item.type)) return -1;

    if (STACKABLE.has(item.type)) {
      const stackedIndex = slots.findIndex(slot => slot && slot.type === item.type);
      if (stackedIndex >= 0) {
        slots[stackedIndex].count += item.count;
        persist();
        return stackedIndex;
      }
    } else {
      const duplicateIndex = slots.findIndex(slot => slot && slot.type === item.type && (item.type === 'backpack' || slot.id === item.id));
      if (duplicateIndex >= 0) return duplicateIndex;
    }

    const index = firstFree();
    if (index < 0) return -1;
    slots[index] = item;
    persist();
    return index;
  }

  function remove(slotIndex) {
    const index = Math.floor(Number(slotIndex));
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT || !slots[index]) return null;
    const removed = copyItem(slots[index]);
    slots[index] = null;
    persist();
    return removed;
  }

  function consume(slotIndex, amount = 1) {
    const index = Math.floor(Number(slotIndex));
    const count = Math.max(1, Math.floor(Number(amount) || 1));
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT || !slots[index]) return null;
    const consumed = copyItem(slots[index]);
    const taken = Math.min(count, slots[index].count);
    consumed.count = taken;
    slots[index].count -= taken;
    if (slots[index].count <= 0) slots[index] = null;
    persist();
    return consumed;
  }

  function selectHotbar(index) {
    const next = Math.floor(Number(index));
    if (!Number.isInteger(next) || next < 0 || next >= HOTBAR_COUNT) return false;
    activeIndex = next;
    return true;
  }

  function selectSlot(index) {
    const next = Math.floor(Number(index));
    if (!Number.isInteger(next) || next < 0 || next >= SLOT_COUNT) return false;
    activeIndex = next;
    return true;
  }

  function count(type) {
    return slots.reduce((total, item) => total + (item && item.type === type ? item.count : 0), 0);
  }

  return {
    slots: () => slots,
    hotbar: () => slots.slice(0, HOTBAR_COUNT),
    backpack: () => slots.slice(HOTBAR_COUNT),
    add,
    remove,
    consume,
    selectHotbar,
    selectSlot,
    getActive: () => slots[activeIndex],
    getActiveIndex: () => activeIndex,
    count,
    hasBackpack: () => slots.some(item => item && item.type === 'backpack'),
    maxSlots: () => SLOT_COUNT
  };
}
