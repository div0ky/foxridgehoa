/** Allowed Lucide names for Important Documents cards (admin picker + landing). */

export const importantDocumentIconOptions = [
  { label: 'Document', value: 'lucide:file-text' },
  { label: 'Clipboard list', value: 'lucide:clipboard-list' },
  { label: 'Pencil / guidelines', value: 'lucide:square-pen' },
  { label: 'Building', value: 'lucide:building-2' },
  { label: 'Scale (legal)', value: 'lucide:scale' },
  { label: 'Folder', value: 'lucide:folder' }
] as const

export type ImportantDocumentCardIcon = typeof importantDocumentIconOptions[number]['value']

export const defaultImportantDocumentIcon: ImportantDocumentCardIcon = 'lucide:file-text'

const legacyImportantDocumentIcons: Record<string, ImportantDocumentCardIcon> = {
  'heroicons:building-office-2': 'lucide:building-2',
  'heroicons:clipboard-document-list': 'lucide:clipboard-list',
  'heroicons:document-text': 'lucide:file-text',
  'heroicons:folder': 'lucide:folder',
  'heroicons:pencil-square': 'lucide:square-pen',
  'heroicons:scale': 'lucide:scale'
}

export function normalizeImportantDocumentIcon(icon?: string): ImportantDocumentCardIcon {
  if (!icon)
    return defaultImportantDocumentIcon

  const allowedIcon = importantDocumentIconOptions.find(option => option.value === icon)
  if (allowedIcon)
    return allowedIcon.value

  return legacyImportantDocumentIcons[icon] ?? defaultImportantDocumentIcon
}
