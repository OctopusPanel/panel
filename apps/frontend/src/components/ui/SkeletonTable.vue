<script setup lang="ts">
interface Props {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  columns: 5,
  rows: 5,
  showHeader: true,
});

// Variable width percentages for natural table cell skeleton look
const cellWidths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-4/5', 'w-1/3', 'w-3/5'];
function getCellWidth(row: number, col: number) {
  return cellWidths[(row * 2 + col) % cellWidths.length];
}
</script>

<template>
  <div class="w-full overflow-hidden animate-shimmer" aria-hidden="true">
    <table class="w-full text-left text-xs">
      <thead
        v-if="showHeader"
        class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border"
      >
        <tr>
          <th
            v-for="col in columns"
            :key="`th-${col}`"
            class="py-3 px-4"
          >
            <div class="h-3 w-16 bg-surface-elevated rounded animate-pulse"></div>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-surface-border/50">
        <tr
          v-for="row in rows"
          :key="`tr-${row}`"
          class="hover:bg-surface-elevated/20 transition-colors"
        >
          <td
            v-for="col in columns"
            :key="`td-${row}-${col}`"
            class="py-3 px-4"
          >
            <div
              class="h-3.5 bg-surface-elevated rounded animate-pulse"
              :class="getCellWidth(row, col)"
            ></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
