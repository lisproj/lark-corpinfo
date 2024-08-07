<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IField } from '@lark-base-open/js-sdk'
import { FieldType, bitable } from '@lark-base-open/js-sdk'
import axios from 'axios'
import { allDisabled } from '@/hooks/useDisabled'

const { t } = useI18n()

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
const mainFieldOptions = ref([])

const checkboxOptions = [
  { value: 'companyName', label: 'labels.checkbox_group.companyName' },
  { value: 'creditNo', label: 'labels.checkbox_group.creditNo' },
  { value: 'companyCode', label: 'labels.checkbox_group.companyCode' },
  { value: 'legalPerson', label: 'labels.checkbox_group.legalPerson' },
  { value: 'orgCode', label: 'labels.checkbox_group.orgCode' },
  { value: 'companyStatus', label: 'labels.checkbox_group.companyStatus' },
  { value: 'establishDate', label: 'labels.checkbox_group.establishDate' },
  { value: 'issueDate', label: 'labels.checkbox_group.issueDate' },
  { value: 'companyType', label: 'labels.checkbox_group.companyType' },
  { value: 'capital', label: 'labels.checkbox_group.capital' },
  { value: 'industry', label: 'labels.checkbox_group.industry' },
  { value: 'companyAddress', label: 'labels.checkbox_group.companyAddress' },
  { value: 'businessScope', label: 'labels.checkbox_group.businessScope' },
  { value: 'operationStartdate', label: 'labels.checkbox_group.operationStartdate' },
  { value: 'operationEnddate', label: 'labels.checkbox_group.operationEnddate' },
  { value: 'authority', label: 'labels.checkbox_group.authority' },
  { value: 'errorTips', label: 'labels.checkbox_group.errorTips' },
  { value: 'fetchTime', label: 'labels.checkbox_group.fetchTime' },
]

const isForcedEnd = ref(false)
const mappedFieldIds: Record<string, string> = {}
const checkAll = computed(() => checkboxOptions.length === formData.checkbox.length)
const indeterminate = computed(() => !!(checkboxOptions.length > formData.checkbox.length && formData.checkbox.length))
const isDisabled = computed(() => !(formData.fieldId !== '' && formData.appCode !== '' && formData.checkbox.length > 0))

async function setFieldList() {
  const selection = await bitable.base.getSelection()
  const table = await bitable.base.getTableById(selection.tableId)
  const view = await table.getViewById(selection.viewId)
  const viewMetaList = await view.getFieldMetaList()

  mainFieldOptions.value = viewMetaList.filter(item => item.type === FieldType.Text)
}

function handleSelectAll(value: any) {
  formData.checkbox = value ? checkboxOptions.map(option => option.value) : []
}

async function onSubmit(this: any) {
  if (allDisabled.value)
    isForcedEnd.value = true
  allDisabled.value = true

  const { viewId } = await bitable.base.getSelection()
  const table = await bitable.base.getActiveTable()
  const view = await table.getViewById(viewId)
  const fieldMetaList = await table.getFieldMetaList()
  const fieldTypeMap: Record<string, FieldType> = {
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

  const promises = formData.checkbox.map(async (checkboxValue: string) => {
    const fieldMeta = fieldMetaList.find(field => field.name === t(`labels.checkbox_group.${checkboxValue}`))
    if (fieldMeta) {
      mappedFieldIds[checkboxValue] = fieldMeta.id
    }
    else {
      const newField = await table.addField({
        name: t(`labels.checkbox_group.${checkboxValue}`),
        type: fieldTypeMap[checkboxValue as keyof typeof fieldTypeMap],
      })
      mappedFieldIds[checkboxValue] = newField
    }
  })
  await Promise.all(promises)

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
    catch {
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
      const updateData: Record<string, string | FieldType> = {}

      for (const field of formData.checkbox) {
        if (field === 'fetchTime') {
          updateData[mappedFieldIds[field]] = Date.now()
        }
        else if (['operationStartdate', 'issueDate', 'establishDate', 'operationEnddate'].includes(field) && info.data.data.data[field]) {
          const datePart = info.data.data.data[field].split(' ')[0]
          const timestamp = new Date(datePart).getTime()
          updateData[mappedFieldIds[field]] = timestamp
        }
        else if (typeof info.data.data.data[field] === 'string' && info.data.data.data[field].includes('万人民币')) {
          const numericPart = Number.parseFloat(info.data.data.data[field].replace('万人民币', '')) * 10000
          updateData[mappedFieldIds[field]] = numericPart.toFixed(6)
        }
        else {
          updateData[mappedFieldIds[field]] = info.data.data.data[field]
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

  allDisabled.value = false

  this.$message.success(t('messages.success.finished'))
}

async function getCellValueByRFIDS(recordId: string, field: IField<any, any, any>) {
  const cellValue = await field.getValue(recordId)
  if (typeof cellValue == 'object')
    return cellValue[0].text

  return cellValue
}

async function handleError(errorMsg: string, recordId: string, errorDetail: any) {
  const table = await bitable.base.getActiveTable()
  await table.setCellValue(
    mappedFieldIds.errorTips,
    recordId,
    [{ type: 'text', text: `${errorMsg} ${errorDetail}` }],
  )
  this.$message.warning(t('messages.error.has_error'))
}

async function getServiceApi(keyword: string, appCode: string, serviceType: string) {
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
  <a-form
    :model="formData"
    layout="vertical"
    :disabled="allDisabled"
    @submit="onSubmit"
  >
    <a-form-item
      field="field"
      :label="t('labels.field')"
    >
      <a-select
        v-model="formData.fieldId"
        :placeholder="t('placeholder.field')"
      >
        <a-option
          v-for="meta in mainFieldOptions"
          :key="meta.id"
          :value="meta.id"
          :label="meta.name"
        />
      </a-select>
    </a-form-item>
    <a-form-item
      field="serviceType"
      :label="t('labels.service_type')"
    >
      <a-radio-group
        v-model="formData.serviceType"
        type="button"
      >
        <a-radio value="shumai">
          {{ t('text.type_shumai') }}
        </a-radio>
        <a-radio value="shulian">
          {{ t('text.type_shulian') }}
        </a-radio>
      </a-radio-group>
    </a-form-item>
    <a-form-item
      field="input"
      :label="t('labels.appcode')"
      :help="t('labels.help_appcode')"
    >
      <a-input
        v-model="formData.appCode"
        :placeholder="t('placeholder.appcode')"
      />
    </a-form-item>
    <a-form-item no-style>
      <a-space
        direction="vertical"
        fill
      >
        <a-checkbox
          :model-value="checkAll"
          :indeterminate="indeterminate"
          class="checkbox"
          @change="handleSelectAll"
        >
          {{ t('labels.checkbox_group.checkall') }}
        </a-checkbox>
        <a-checkbox-group v-model="formData.checkbox">
          <a-grid :cols="2" :col-gap="0" :row-gap="8">
            <a-grid-item
              v-for="option in checkboxOptions"
              :key="option.value"
            >
              <a-checkbox :value="option.value">
                {{ t(option.label) }}
              </a-checkbox>
            </a-grid-item>
          </a-grid>
        </a-checkbox-group>
      </a-space>
    </a-form-item>
    <a-form-item>
      <a-button
        type="primary"
        html-type="submit"
        :disabled="isDisabled"
      >
        {{ t('text.submit') }}
      </a-button>
    </a-form-item>
  </a-form>
</template>

<style scoped>
.checkbox {
  margin-top: 8px;
}
</style>
