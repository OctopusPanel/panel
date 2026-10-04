<script setup lang="ts">
// Shimmer skeleton card for dashboard and fleet rosters
</script>

<template>
  <div
    class="bg-surface-card border border-surface-border rounded-xl p-5 shadow-lg flex flex-col justify-between animate-shimmer"
    aria-hidden="true"
  >
    <div>
      <!-- Top Row: Name, Identifier & Status Pill -->
      <div class="flex items-start justify-between mb-3">
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full bg-surface-elevated animate-pulse shrink-0"></span>
            <div class="h-4 w-36 bg-surface-elevated rounded animate-pulse"></div>
          </div>
          <div class="flex items-center space-x-2">
            <div class="h-3 w-16 bg-surface-elevated rounded animate-pulse"></div>
            <span class="text-slate-600">&bull;</span>
            <div class="h-3 w-24 bg-surface-elevated rounded animate-pulse"></div>
          </div>
        </div>
        <div class="h-5 w-16 bg-surface-elevated rounded-full animate-pulse shrink-0"></div>
      </div>

      <!-- Mini Telemetry Gauges -->
      <div class="grid grid-cols-2 gap-2.5 my-4">
        <div class="bg-surface-deep p-2.5 rounded-lg border border-surface-border space-y-2">
          <div class="flex items-center justify-between">
            <div class="h-3 w-10 bg-surface-elevated rounded animate-pulse"></div>
            <div class="h-3 w-8 bg-surface-elevated rounded animate-pulse"></div>
          </div>
          <div class="w-full bg-surface-card h-1.5 rounded-full overflow-hidden">
            <div class="h-full bg-surface-elevated rounded-full w-2/3 animate-pulse"></div>
          </div>
          <div class="h-2 w-14 bg-surface-elevated rounded animate-pulse"></div>
        </div>

        <div class="bg-surface-deep p-2.5 rounded-lg border border-surface-border space-y-2">
          <div class="flex items-center justify-between">
            <div class="h-3 w-10 bg-surface-elevated rounded animate-pulse"></div>
            <div class="h-3 w-10 bg-surface-elevated rounded animate-pulse"></div>
          </div>
          <div class="w-full bg-surface-card h-1.5 rounded-full overflow-hidden">
            <div class="h-full bg-surface-elevated rounded-full w-1/2 animate-pulse"></div>
          </div>
          <div class="h-2 w-14 bg-surface-elevated rounded animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Card Footer -->
    <div class="pt-3 border-t border-surface-border flex items-center justify-between">
      <div class="flex items-center space-x-1.5">
        <div class="w-6 h-6 rounded-md bg-surface-elevated animate-pulse"></div>
        <div class="w-6 h-6 rounded-md bg-surface-elevated animate-pulse"></div>
        <div class="w-6 h-6 rounded-md bg-surface-elevated animate-pulse"></div>
      </div>
      <div class="h-3.5 w-24 bg-surface-elevated rounded animate-pulse"></div>
    </div>
  </div>
</template>
