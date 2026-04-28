<script setup lang="ts">
interface Props {
  authorDisplayName?: string
  description?: string
  postedAtLabel?: string
  title?: string
}

withDefaults(defineProps<Props>(), {
  authorDisplayName: 'Fox Ridge HOA',
  description: 'News and reminders from the Fox Ridge HOA board.',
  postedAtLabel: '',
  title: 'Community update'
})
</script>

<template>
  <div
    :style="{
      alignItems: 'stretch',
      background: '#f0fdfa',
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      height: '100%',
      justifyContent: 'space-between',
      padding: '64px',
      position: 'relative',
      width: '100%'
    }"
  >
    <div
      :style="{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        position: 'relative',
        width: '100%'
      }"
    >
      <div
        :style="{
          alignItems: 'center',
          display: 'flex',
          gap: '18px'
        }"
      >
        <div
          :style="{
            alignItems: 'center',
            background: '#0f766e',
            borderRadius: '26px',
            color: '#ffffff',
            display: 'flex',
            fontSize: '38px',
            fontWeight: 900,
            height: '76px',
            justifyContent: 'center',
            width: '76px'
          }"
        >
          FR
        </div>
        <div
          :style="{
            display: 'flex',
            flexDirection: 'column'
          }"
        >
          <div
            :style="{
              color: '#0f766e',
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }"
          >
            Community Update
          </div>
          <div
            :style="{
              color: '#475569',
              fontSize: '25px',
              marginTop: '6px'
            }"
          >
            Fox Ridge HOA
          </div>
        </div>
      </div>

      <div
        v-if="postedAtLabel"
        :style="{
          background: 'rgba(255, 255, 255, 0.76)',
          border: '1px solid rgba(148, 163, 184, 0.38)',
          borderRadius: '9999px',
          color: '#334155',
          fontSize: '24px',
          fontWeight: 700,
          padding: '14px 22px'
        }"
      >
        {{ postedAtLabel }}
      </div>
    </div>

    <div
      :style="{
        background: 'rgba(255, 255, 255, 0.82)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: '42px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        padding: '46px',
        position: 'relative'
      }"
    >
      <div
        :style="{
          color: '#0f172a',
          fontSize: '68px',
          fontWeight: 900,
          letterSpacing: '-0.045em',
          lineHeight: 1.02
        }"
      >
        {{ title }}
      </div>
      <div
        :style="{
          color: '#334155',
          fontSize: '32px',
          lineHeight: 1.35
        }"
      >
        {{ description }}
      </div>
    </div>

    <div
      :style="{
        alignItems: 'center',
        color: '#475569',
        display: 'flex',
        fontSize: '25px',
        fontWeight: 700,
        justifyContent: 'space-between',
        position: 'relative',
        width: '100%'
      }"
    >
      <div>{{ authorDisplayName }}</div>
      <div>foxridgehoa.com/updates</div>
    </div>
  </div>
</template>
