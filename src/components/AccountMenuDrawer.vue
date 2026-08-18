<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useShopRoute } from '../composables/useShopRoute'
import { useUiSettingsStore } from '../stores/uiSettings'
import PushNotificationToggle from './PushNotificationToggle.vue'

const auth = useAuthStore()
const router = useRouter()
const { shopPath } = useShopRoute()
const ui = useUiSettingsStore()

const menuOpen = ref(false)

const lineChatUrl = computed(() => ui.get('ui_line_chat_url', 'https://line.me'))
const lineMenuLabel = computed(() => ui.get('ui_profile_line_label', 'ติดต่อร้านทาง LINE'))

const isPhoneAccount = computed(() => auth.user?.provider === 'phone')

const loginLabel = computed(() => {
  if (isPhoneAccount.value) return auth.user?.provider_id || '-'
  if (auth.user?.provider === 'google') return 'Google'
  if (auth.user?.provider === 'facebook') return 'Facebook'
  if (auth.user?.provider === 'line') return 'LINE'
  return auth.user?.provider || '-'
})

const userSubtitle = computed(() =>
  isPhoneAccount.value ? auth.user?.provider_id || loginLabel.value : loginLabel.value
)

const initials = computed(() => {
  const n = auth.user?.name || ''
  return n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'NA'
})

function openMenu() {
  menuOpen.value = true
}

function closeMenu() {
  menuOpen.value = false
}

function logout() {
  closeMenu()
  auth.logout()
  router.push(shopPath('/login'))
}

function openLine() {
  closeMenu()
  window.open(lineChatUrl.value, '_blank', 'noopener,noreferrer')
}

function onMenuKeydown(event) {
  if (event.key === 'Escape') closeMenu()
}

watch(menuOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('keydown', onMenuKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onMenuKeydown)
  if (menuOpen.value) document.body.style.overflow = ''
})
</script>

<template>
  <button
    type="button"
    class="account-menu-trigger avatar app-avatar"
    :title="auth.user?.name"
    :aria-expanded="menuOpen"
    aria-label="เปิดเมนูบัญชี"
    @click="openMenu"
  >
    {{ initials }}
  </button>

  <Teleport to="body">
    <Transition name="account-menu-backdrop">
      <button
        v-if="menuOpen"
        type="button"
        class="account-menu-backdrop"
        aria-label="ปิดเมนู"
        @click="closeMenu"
      />
    </Transition>

    <Transition name="account-menu-drawer">
      <aside
        v-if="menuOpen"
        class="account-menu-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="เมนูบัญชี"
      >
        <div class="account-menu-head">
          <div class="account-menu-user">
            <span class="account-menu-avatar app-avatar">{{ initials }}</span>
            <div class="account-menu-user-text">
              <strong>{{ auth.user?.name || 'สมาชิก' }}</strong>
              <span class="muted">{{ userSubtitle }}</span>
            </div>
          </div>
          <button type="button" class="account-menu-close" aria-label="ปิดเมนู" @click="closeMenu">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        <div v-if="auth.isLoggedIn" class="account-menu-push">
          <PushNotificationToggle />
        </div>

        <nav class="account-menu-actions">
          <button type="button" class="account-menu-line" @click="openLine">
            <i class="ti ti-brand-line" aria-hidden="true"></i>
            {{ lineMenuLabel }}
          </button>
          <button type="button" class="account-menu-logout" @click="logout">
            <i class="ti ti-logout" aria-hidden="true"></i>
            ออกจากระบบ
          </button>
        </nav>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.account-menu-trigger {
  border: none;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
  transition: transform var(--transition), box-shadow var(--transition);
}

.account-menu-trigger:hover {
  box-shadow: var(--shadow-sm);
}

.account-menu-trigger:active {
  transform: scale(0.96);
}

.account-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-overlay) + 1);
  border: none;
  padding: 0;
  background: var(--color-overlay);
  cursor: pointer;
}

.account-menu-backdrop-enter-active,
.account-menu-backdrop-leave-active {
  transition: opacity var(--transition);
}

.account-menu-backdrop-enter-from,
.account-menu-backdrop-leave-to {
  opacity: 0;
}

.account-menu-drawer {
  position: fixed;
  top: 0;
  right: max(0px, calc((100vw - var(--page-max-width)) / 2));
  bottom: 0;
  z-index: calc(var(--z-sheet) + 1);
  width: min(300px, 88vw);
  max-width: var(--page-max-width);
  background: var(--color-surface-elevated);
  border-left: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
}

.account-menu-drawer-enter-active,
.account-menu-drawer-leave-active {
  transition: transform var(--transition-sheet);
}

.account-menu-drawer-enter-from,
.account-menu-drawer-leave-to {
  transform: translateX(100%);
}

.account-menu-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.account-menu-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.account-menu-avatar {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.account-menu-user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.account-menu-user-text strong {
  font-size: var(--text-body);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-menu-user-text .muted {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.account-menu-close {
  width: var(--touch-min);
  height: var(--touch-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 20px;
}

.account-menu-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: auto;
}

.account-menu-push {
  margin-bottom: var(--space-4);
}

.account-menu-line {
  width: 100%;
  min-height: var(--touch-min);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-line);
  color: var(--color-on-primary);
  font-size: var(--text-body);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: background var(--transition), transform var(--transition);
}

.account-menu-line:hover {
  background: var(--color-line-hover);
}

.account-menu-line:active {
  transform: scale(0.98);
}

.account-menu-line i {
  font-size: 22px;
}

.account-menu-logout {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--color-error) 22%, transparent);
  background: color-mix(in srgb, var(--color-error) 6%, transparent);
  color: var(--color-error);
  font-size: var(--text-body);
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  padding: var(--space-3);
  min-height: var(--touch-min);
  border-radius: var(--radius-md);
  transition: background var(--transition), border-color var(--transition), transform var(--transition);
}

.account-menu-logout:hover {
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-error) 32%, transparent);
}

.account-menu-logout:active {
  transform: scale(0.98);
}

.account-menu-logout i {
  font-size: 18px;
}

@media (prefers-reduced-motion: reduce) {
  .account-menu-drawer-enter-active,
  .account-menu-drawer-leave-active,
  .account-menu-backdrop-enter-active,
  .account-menu-backdrop-leave-active {
    transition: none;
  }
}
</style>
