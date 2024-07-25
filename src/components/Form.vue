<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FormExtraction from '@/components/forms/FormExtraction.vue'
// import FormVerification from '@/components/forms/FormVerification.vue'
import InfoTip from '@/components/utils/InfoTip.vue'

const { t } = useI18n()
</script>

<template>
  <div style="min-width: 100%;">
    <a-alert :show-icon="false">
      <a-link
        href="https://feishu.cn/docx/SvKGddsnOoIdGZxbP3DcrSQpnfA#XhtEdE8uIovuDYxYsyEcLyuBnle"
        target="_blank"
        icon
      >
        {{ t('text.alert_link') }}
      </a-link>
    </a-alert>
    <a-tabs
      animation
    >
      <a-tab-pane key="extraction">
        <template #title>
          <icon-bookmark />
          完整信息提取
          <InfoTip content="根据完整信息关键字（企业名称、注册号、统一社会信用代码等）提取出更多企业相关信息（法人、注册地址等）" />
        </template>
        <FormExtraction />
      </a-tab-pane>
      <a-tab-pane key="verification">
        <template #title>
          <icon-tag />
          模糊校验补全
          <InfoTip content="通过企业关键字（模糊不完整的公司名称/社会统一信用代码）校验并补全部分详细信息（详细企业名称、注册号、统一社会信用代码等）" />
        </template>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
