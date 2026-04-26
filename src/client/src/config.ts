export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

  if (configuredBaseUrl !== undefined) {
    return configuredBaseUrl.replace(/\/+$/, '')
  }

  return import.meta.env.DEV ? 'http://localhost:5051' : ''
}
