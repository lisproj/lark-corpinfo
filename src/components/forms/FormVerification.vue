<!-- eslint-disable no-console -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IFieldMeta, ITextField } from '@lark-base-open/js-sdk'
import { FieldType, ToastType, bitable } from '@lark-base-open/js-sdk'
import axios from 'axios'
import InfoTip from '@/components/utils/InfoTip.vue'
import { allDisabled } from '@/hooks/useDisabled'

const { t } = useI18n()

interface FormData {
  serviceType: string
  appCode: string
  checkbox: string[]
  processMode: {
    autoProcess: boolean
    onlyProcessSelected: boolean
  }
  fieldId: {
    keyword: string
    companyName: string
    companyCode: string
    legalPerson: string
    creditNo: string
  }
}

interface CompanyResp {
  companyCode: string
  companyName: string
  legalPerson: string
  creditNo: string
}

const formData = reactive<FormData>({
  serviceType: 'shumai',
  appCode: '',
  checkbox: [
    'companyName',
  ],
  processMode: {
    autoProcess: true,
    onlyProcessSelected: false,
  },
  fieldId: {
    keyword: '',
    companyName: '',
    companyCode: '',
    creditNo: '',
    legalPerson: '',
  },
})
const textFieldOptions = ref<IFieldMeta[]>([])
const textNumberFieldOptions = ref<IFieldMeta[]>([])
const rcdId = ref()
const resp = ref()

const checkboxOptions = [
  { value: 'companyName', label: 'labels.checkbox_group.companyName' },
  { value: 'creditNo', label: 'labels.checkbox_group.creditNo' },
  { value: 'companyCode', label: 'labels.checkbox_group.companyCode' },
  { value: 'legalPerson', label: 'labels.checkbox_group.legalPerson' },
]
const isDisabled = computed(() => !(formData.fieldId.keyword !== '' && formData.appCode !== '' && formData.fieldId.companyName !== ''))

const visibleSelectDrawer = ref(false)
const drawerName = ref('')
const drawerTableColumns = [
  {
    title: t('labels.checkbox_group.companyName'),
    dataIndex: 'companyName',
  },
]
const drawerTableData = ref<CompanyResp[]>([])
const drawerTableScroll = {
  x: 465,
  y: '100%',
}
const drawertableRowSelection = {
  type: 'radio',
}
const drawerTableSelectedKeys = ref([])

async function setFieldList(): Promise<void> {
  const table = await bitable.base.getActiveTable()
  const view = await table.getActiveView()
  const fieldMetaList: IFieldMeta[] = await view.getFieldMetaList()
  textFieldOptions.value = fieldMetaList.filter(item => item.type === FieldType.Text)
  textNumberFieldOptions.value = fieldMetaList.filter(item => item.type === FieldType.DateTime)
}

async function onSubmit(): Promise<void> {
  allDisabled.value = true

  if (formData.appCode !== '') {
    if (formData.checkbox.length > 0) {
      if (formData.checkbox.some((checkboxValue: string | number | symbol) => {
        const fieldIdValue = formData.fieldId[checkboxValue as keyof typeof formData.fieldId]
        return checkboxOptions.some(option => option.value === checkboxValue && fieldIdValue === '')
      })) {
        allDisabled.value = false
        await bitable.ui.showToast({
          toastType: ToastType.warning,
          message: t('messages.error.no_selected_output_field'),
        })
      }
      else {
        if (formData.processMode.onlyProcessSelected === false) {
          if (formData.fieldId.keyword === '') {
            allDisabled.value = false
            await bitable.ui.showToast({
              toastType: ToastType.warning,
              message: t('messages.error.no_selected_input_field'),
            })
          }
          await processField()
        }
        else if (formData.processMode.onlyProcessSelected === true) {
          await processSelected()
        }
      }
    }
    else {
      allDisabled.value = false
      await bitable.ui.showToast({
        toastType: ToastType.warning,
        message: t('messages.error.no_checked_output_option'),
      })
    }
  }
  else {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.warning,
      message: t('messages.error.no_appcode'),
    })
  }
}

async function processField(): Promise<void> {
  const table = await bitable.base.getActiveTable()

  const recordList = await table.getRecordIdList()

  for (const recordId of recordList) {
    const textField = await table.getFieldById(formData.fieldId.keyword)

    let textFieldValue
    try {
      const cellValue = await textField.getValue(recordId)
      if (typeof cellValue == 'object')
        textFieldValue = cellValue[0].text
    }
    catch {
      continue
    }

    let response: CompanyResp[] = []
    let objects
    try {
      response = await getServiceApi(textFieldValue)
      objects = response.filter(item => typeof item === 'object')
    }
    catch (error) {
      await bitable.ui.showToast({
        toastType: ToastType.error,
        message: t('messages.error.fetch_error') + error,
      })
      continue
    }

    if (response) {
      if (objects && response && objects.length >= 2) {
        if (formData.processMode.autoProcess === false) {
          rcdId.value = recordId
          resp.value = response
          openSelectDrawer(textFieldValue, response)
        }
        else {
          await writeValue(recordId, response[0])
        }
      }
      else if (response !== undefined) {
        await writeValue(recordId, response[0])
      }
    }
  }
  allDisabled.value = false
}

async function processSelected(): Promise<void> {
  const { fieldId, recordId } = await bitable.base.getSelection()
  const table = await bitable.base.getActiveTable()
  if (fieldId === null || recordId === null) {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.error,
      message: t('messages.error.no_selection'),
    })
    return
  }
  const fieldMeta = await table.getFieldMetaById(fieldId)
  if (fieldMeta.type !== FieldType.Text) {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.error,
      message: t('messages.error.type_not_text'),
    })
    return
  }
  const textField = await table.getField<ITextField>(fieldId)
  const textFieldValue = await textField.getValue(recordId)
  let response: CompanyResp[] = []
  let objects
  try {
    response = await getServiceApi(textFieldValue[0].text)
    objects = response.filter(item => typeof item === 'object')
  }
  catch (error) {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.error,
      message: t('messages.error.fetch_error') + error,
    })
    return
  }
  if (objects && response && objects.length >= 2) {
    if (formData.processMode.autoProcess === false) {
      rcdId.value = recordId
      resp.value = response
      openSelectDrawer(textFieldValue[0].text, response)
    }
    else {
      await writeValue(recordId, response[0])
    }
  }
  else if (response !== undefined) {
    await writeValue(recordId, response[0])
  }
  else {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.error,
      message: t('messages.error.fetch_error'),
    })
  }
}

async function getServiceApi(keyword: string): Promise<[]> {
  let api = ''
  if (formData.serviceType === 'shulian')
    api = 'https://slyqyxx.market.alicloudapi.com/business3/get'
  else if (formData.serviceType === 'shumai')
    api = 'https://businessfuzzy.shumaidata.com/getbusinessfuzzy'
  let response
  response = await axios.get(api, {
    params: {
      keyword,
    },
    headers: {
      Authorization: `APPCODE ${formData.appCode}`,
    },
  })
  if (formData.serviceType === 'shulian' || formData.serviceType === 'shumai')
    response = response.data.data.data
  return response
}

function openSelectDrawer(name: string, response: CompanyResp[]) {
  drawerName.value = name
  drawerTableData.value = response
  visibleSelectDrawer.value = true
}

function handleConfirmClick() {
  visibleSelectDrawer.value = false
  const selectedKeys = drawerTableSelectedKeys.value
  const selectedCompany: CompanyResp = (resp.value as CompanyResp[]).find(company => company.companyName === selectedKeys[0])!
  writeValue(rcdId.value, selectedCompany, true)
}

async function writeValue(value: string, company: CompanyResp, end?: boolean) {
  const table = await bitable.base.getActiveTable()

  const textField = await table.getField<ITextField>(formData.fieldId.companyName)
  await textField.setValue(value, company.companyName)

  if (end) {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.success,
      message: t('messages.success.finished'),
    })
  }
}

onMounted(async () => {
  setFieldList()
  const table = await bitable.base.getActiveTable()
  table.onFieldModify((() => {
    setFieldList()
  }))
})

bitable.base.onSelectionChange((() => {
  setFieldList()
}))
</script>

<template>
  <a-form
    v-model="formData"
    layout="vertical"
    :disabled="allDisabled"
    @submit="onSubmit"
  >
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
    >
      <a-input
        v-model="formData.appCode"
        :placeholder="t('placeholder.appcode')"
      />
    </a-form-item>
    <a-form-item
      field="processMode"
      :label="$t('labels.process_mode.group')"
    >
      <a-space direction="vertical">
        <a-radio-group
          v-model="formData.processMode.autoProcess"
          type="button"
        >
          <a-radio :value="true">
            {{ $t('text.process_mode.auto_select') }} <InfoTip content="自动选择最匹配企业名称关键词的公司，适合关键词较精确或名称相似企业较少情况" />
          </a-radio>
          <a-radio :value="false">
            {{ $t('text.process_mode.drawer_select') }} <InfoTip content="遇到有两个以上符合关键词要求的公司则弹出对话框手动确认公司，适合关键词更模糊或名称相似企业较多情况" />
          </a-radio>
        </a-radio-group>
        <a-radio-group
          v-model="formData.processMode.onlyProcessSelected"
          type="button"
        >
          <a-radio :value="false">
            {{ $t('text.process_mode.process_field') }}
          </a-radio>
          <a-radio :value="true">
            {{ $t('text.process_mode.process_selected') }}
          </a-radio>
        </a-radio-group>
      </a-space>
    </a-form-item>
    <a-form-item
      v-if="formData.processMode.onlyProcessSelected === false"
      field="inputKeywordField"
      :label="t('labels.field')"
    >
      <a-select
        v-model="formData.fieldId.keyword"
        :placeholder="t('placeholder.field')"
      >
        <a-option
          v-for="meta in textFieldOptions"
          :key="meta.id"
          :value="meta.id"
          :label="meta.name"
        />
      </a-select>
    </a-form-item>
    <div>
      <a-form-item
        field="outputCompanyNameField"
        :label="$t('labels.output_company_name')"
      >
        <a-select
          v-model="formData.fieldId.companyName"
          :placeholder="$t('placeholder.output_company_name')"
        >
          <a-option
            v-for="meta in textFieldOptions"
            :key="meta.id"
            :value="meta.id"
            :label="meta.name"
          />
        </a-select>
      </a-form-item>
    </div>
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
  <a-drawer
    width="full"
    :closable="false"
    :hide-cancel="true"
    :esc-to-close="false"
    :mask-closable="false"
    :visible="visibleSelectDrawer"
    @ok="handleConfirmClick"
  >
    <template #title>
      <a-typography-title :heading="7">
        {{ $t('text.drawer.need_select') }}
      </a-typography-title>
    </template>
    <div>
      <a-space
        direction="vertical"
        fill
      >
        <div>
          {{ $t('text.drawer.find_tips_front') }} <a-typography-text bold>
            {{ drawerName }}
          </a-typography-text>
          {{ $t('text.drawer.find_tips_end') }}
        </div>
        <a-table
          v-model:selectedKeys="drawerTableSelectedKeys"
          :columns="drawerTableColumns"
          :data="drawerTableData"
          row-key="companyName"
          :sticky-header="true"
          :column-resizable="true"
          :pagination="false"
          :row-selection="drawertableRowSelection"
          :scroll="drawerTableScroll"
          :scrollbar="true"
        />
      </a-space>
    </div>
  </a-drawer>
</template>
