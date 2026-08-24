import api from './axios'

/** Admin API scoped to a specific branch (super admin on default). */
export function shopAdminRequest(shopSlug, config = {}) {
  if (!shopSlug) {
    return Promise.reject(new Error('ต้องระบุสาขา'))
  }
  return api.request({
    ...config,
    headers: {
      ...(config.headers || {}),
      'X-Shop-Slug': shopSlug,
    },
  })
}

export const shopAdminApi = {
  get: (shopSlug, url, config) => shopAdminRequest(shopSlug, { ...config, method: 'get', url }),
  patch: (shopSlug, url, data, config) =>
    shopAdminRequest(shopSlug, { ...config, method: 'patch', url, data }),
  post: (shopSlug, url, data, config) =>
    shopAdminRequest(shopSlug, { ...config, method: 'post', url, data }),
  delete: (shopSlug, url, config) => shopAdminRequest(shopSlug, { ...config, method: 'delete', url }),
}
