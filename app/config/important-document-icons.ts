/** Allowed Heroicon names for Important Documents cards (admin picker + landing). */

export const importantDocumentIconOptions = [
  { label: 'Document', value: 'heroicons:document-text' },
  { label: 'Clipboard list', value: 'heroicons:clipboard-document-list' },
  { label: 'Pencil / guidelines', value: 'heroicons:pencil-square' },
  { label: 'Building', value: 'heroicons:building-office-2' },
  { label: 'Scale (legal)', value: 'heroicons:scale' },
  { label: 'Folder', value: 'heroicons:folder' }
] as const

export type ImportantDocumentCardIcon = typeof importantDocumentIconOptions[number]['value']

export const defaultImportantDocumentIcon: ImportantDocumentCardIcon = 'heroicons:document-text'
