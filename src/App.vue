<script setup lang="js">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FieldType, bitable } from '@lark-base-open/js-sdk'
import { MessagePlugin } from 'tdesign-vue-next'
import axios from 'axios'
import { useTheme } from './hooks/useTheme'

const { t } = useI18n()
const mainFieldOptions = ref([])
useTheme()

const formData = reactive({
  fieldId: '',
  serviceType: 'shumai',
  appCode: '',
  checkbox: [
    'creditNo',
    'companyCode',
    'legalPerson',
    'orgCode',
    'companyStatus',
    'establishDate',
    'issueDate',
    'companyType',
    'capital',
    'industry',
    'companyAddress',
    'businessScope',
    'operationStartdate',
    'operationEnddate',
    'authority',
    'errorTips',
    'fetchTime',
  ],
})
const form = ref(null)

const checkboxOptions = [
  { value: 'companyName', label: () => t('labels.checkbox_group.companyName') },
  { value: 'creditNo', label: () => t('labels.checkbox_group.creditNo') },
  { value: 'companyCode', label: () => t('labels.checkbox_group.companyCode') },
  { value: 'legalPerson', label: () => t('labels.checkbox_group.legalPerson') },
  { value: 'orgCode', label: () => t('labels.checkbox_group.orgCode') },
  { value: 'companyStatus', label: () => t('labels.checkbox_group.companyStatus') },
  { value: 'establishDate', label: () => t('labels.checkbox_group.establishDate') },
  { value: 'issueDate', label: () => t('labels.checkbox_group.issueDate') },
  { value: 'companyType', label: () => t('labels.checkbox_group.companyType') },
  { value: 'capital', label: () => t('labels.checkbox_group.capital') },
  { value: 'industry', label: () => t('labels.checkbox_group.industry') },
  { value: 'companyAddress', label: () => t('labels.checkbox_group.companyAddress') },
  { value: 'businessScope', label: () => t('labels.checkbox_group.businessScope') },
  { value: 'operationStartdate', label: () => t('labels.checkbox_group.operationStartdate') },
  { value: 'operationEnddate', label: () => t('labels.checkbox_group.operationEnddate') },
  { value: 'authority', label: () => t('labels.checkbox_group.authority') },
  { value: 'errorTips', label: () => t('labels.checkbox_group.errorTips') },
  { value: 'fetchTime', label: () => t('labels.checkbox_group.fetchTime') },
]

const isLoading = ref(false)
const isForcedEnd = ref(false)
const mappedFieldIds = ref({})
const checkAll = computed(() => checkboxOptions.length === formData.checkbox.length)
const indeterminate = computed(() => !!(checkboxOptions.length > formData.checkbox.length && formData.checkbox.length))
const isDisabled = computed(() => !(formData.fieldId !== '' && formData.appCode !== '' && formData.checkbox.length > 0))

function handleSelectAll(checked) {
  formData.checkbox = checked ? checkboxOptions.map(option => option.value) : []
}

async function setFieldList() {
  const selection = await bitable.base.getSelection()
  const table = await bitable.base.getTableById(selection.tableId)
  const view = await table.getViewById(selection.viewId)
  const viewMetaList = await view.getFieldMetaList()

  mainFieldOptions.value = viewMetaList.filter(item => item.type === 1)
}

async function onSubmit() {
  if (isLoading.value)
    isForcedEnd.value = true

  isLoading.value = true

  const { viewId } = await bitable.base.getSelection()
  const table = await bitable.base.getActiveTable()
  const view = await table.getViewById(viewId)

  const fieldMetaList = await table.getFieldMetaList()
  const fieldTypeMap = {
    companyName: FieldType.Text,
    creditNo: FieldType.Text,
    companyCode: FieldType.Number,
    legalPerson: FieldType.Text,
    orgCode: FieldType.Text,
    companyStatus: FieldType.Text,
    establishDate: FieldType.DateTime,
    issueDate: FieldType.DateTime,
    companyType: FieldType.Text,
    capital: FieldType.Currency,
    industry: FieldType.Text,
    companyAddress: FieldType.Text,
    businessScope: FieldType.Text,
    operationStartdate: FieldType.DateTime,
    operationEnddate: FieldType.DateTime,
    authority: FieldType.Text,
    errorTips: FieldType.Text,
    fetchTime: FieldType.DateTime,
  }

  for (const checkboxValue of formData.checkbox) {
    const fieldMeta = fieldMetaList.find(field => field.name === t(`labels.checkbox_group.${checkboxValue}`))
    if (fieldMeta) {
      mappedFieldIds.value[checkboxValue] = fieldMeta.id
    }
    else {
      const newField = await table.addField({
        name: t(`labels.checkbox_group.${checkboxValue}`),
        type: fieldTypeMap[checkboxValue],
      })
      mappedFieldIds.value[checkboxValue] = newField
    }
  }

  const recordList = await view.getVisibleRecordIdList()

  localStorage.setItem('appCode', formData.appCode)
  localStorage.setItem('serviceType', formData.serviceType)

  for (const recordId of recordList) {
    if (isForcedEnd.value)
      break
    const linkField = await table.getFieldById(formData.fieldId)

    let keyword
    try {
      keyword = await getCellValueByRFIDS(recordId, linkField)
    }
    catch (error) {
      continue
    }

    let info
    try {
      info = await getServiceApi(keyword, formData.appCode, formData.serviceType)
    }
    catch (error) {
      await handleError(t('messages.error.fetch_error'), recordId, error)
      continue
    }

    if (info) {
      const updateData = {}

      for (const field of formData.checkbox) {
        if (field === 'fetchTime') {
          updateData[mappedFieldIds.value[field]] = Date.now()
        }
        else if (['operationStartdate', 'issueDate', 'establishDate', 'operationEnddate'].includes(field) && info.data.data.data[field]) {
          const datePart = info.data.data.data[field].split(' ')[0]
          const timestamp = new Date(datePart).getTime()
          updateData[mappedFieldIds.value[field]] = timestamp
        }
        else if (typeof info.data.data.data[field] === 'string' && info.data.data.data[field].includes('万人民币')) {
          const numericPart = Number.parseFloat(info.data.data.data[field].replace('万人民币', '')) * 10000
          updateData[mappedFieldIds.value[field]] = numericPart.toFixed(6)
        }
        else {
          updateData[mappedFieldIds.value[field]] = info.data.data.data[field]
        }
      }

      try {
        await table.setRecords([{
          recordId,
          fields: updateData,
        }])
      }
      catch (error) {
        await handleError(t('messages.error.set_error'), recordId, error)
      }
    }
  }

  isLoading.value = false
  MessagePlugin.success({
    content: t('messages.success.finished'),
  })
}
async function getCellValueByRFIDS(recordId, field) {
  const cellValue = await field.getValue(recordId)
  if (typeof cellValue == 'object')
    return cellValue[0].text

  return cellValue
}

async function handleError(errorMsg, recordId, errorDetail) {
  const table = await bitable.base.getActiveTable()
  await table.setCellValue(mappedFieldIds.value.errorTips, recordId, [{ type: 'text', text: `${errorMsg} ${errorDetail}` }])
  MessagePlugin.error({
    content: t('messages.error.has_error'),
  })
}

async function getServiceApi(keyword, appCode, serviceType) {
  let api
  if (serviceType === 'shulian')
    api = 'https://slycompany.market.alicloudapi.com/business2/get'
  else if (serviceType === 'shumai')
    api = 'https://businessstd.shumaidata.com/getbusinessstd'
  return await axios.get(api, {
    params: {
      keyword,
    },
    headers: {
      'Authorization': `APPCODE ${appCode}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  })
}

onMounted(async () => {
  setFieldList()
  if (localStorage.getItem('appCode') !== null || localStorage.getItem('serviceType') !== null) {
    formData.serviceType = localStorage.getItem('serviceType')
    formData.appCode = localStorage.getItem('appCode')
  }
})
</script>

<template>
  <t-form ref="form" :data="formData" label-align="top" @submit="onSubmit">
    <t-space direction="vertical" size="small">
      <t-alert>
        <template #message>
          {{ $t('text.alert_message') }}
          <br>
          <t-link theme="primary" href="https://cladonia.feishu.cn/docx/SvKGddsnOoIdGZxbP3DcrSQpnfA#XhtEdE8uIovuDYxYsyEcLyuBnle" target="_blank">
            {{ $t('text.alert_link') }}
          </t-link>
        </template>
      </t-alert>
      <t-form-item :label="$t('labels.field')" name="fieldId">
        <t-select v-model="formData.fieldId" :placeholder="$t('placeholder.field')">
          <t-option v-for="meta in mainFieldOptions" :key="meta.id" :value="meta.id" :label="meta.name" />
        </t-select>
      </t-form-item>
      <t-form-item :label="$t('labels.service_type')" name="serviceType">
        <t-radio-group v-model="formData.serviceType" variant="primary-filled">
          <t-radio-button value="shumai">
            {{ $t('text.type_shumai') }}
          </t-radio-button>
          <t-radio-button value="shulian">
            {{ $t('text.type_shulian') }}
          </t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item :label="$t('labels.appcode')" name="input" :help="$t('labels.help_appcode')">
        <t-input v-model="formData.appCode" :placeholder="$t('placeholder.appcode')" />
      </t-form-item>
      <t-checkbox :checked="checkAll" :indeterminate="indeterminate" :on-change="handleSelectAll">
        {{ $t('labels.checkbox_group.checkall') }}
      </t-checkbox>
      <t-checkbox-group v-model="formData.checkbox" :options="checkboxOptions" />
      <t-form-item>
        <t-button :disabled="isDisabled" :loading="isLoading" type="submit">
          {{ $t('text.submit') }}
        </t-button>
      </t-form-item>
    </t-space>
  </t-form>
</template>

<style scoped>
.t-form {
  padding: 0.5rem;
}
</style>
