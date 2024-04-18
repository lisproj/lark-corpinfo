import { createI18n } from 'vue-i18n'
import { bitable } from '@lark-base-open/js-sdk'
import en from './en.json'
import zh from './zh.json'
import ja from './ja.json'

export const i18n = createI18n({
  locale: 'en',
  allowComposition: true, // 占位符支持
  messages: {
    en,
    zh,
    ja,
  },
})

bitable.bridge.getLanguage().then((lang: any) => {
  i18n.global.locale = lang
})
