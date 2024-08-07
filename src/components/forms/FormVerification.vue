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
const checkAll = computed(() => checkboxOptions.length === formData.checkbox.length)
const indeterminate = computed(() => !!(checkboxOptions.length > formData.checkbox.length && formData.checkbox.length))

const visibleSelectDrawer = ref(false)
const drawerName = ref('')
const drawerTableColumns = [
  {
    title: '名称',
    dataIndex: 'companyName',
  },
  {
    title: '法人',
    dataIndex: 'legalPerson',
  },
  {
    title: '信用代码',
    dataIndex: 'creditNo',
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

function handleSelectAll(value: string): void {
  formData.checkbox = value ? checkboxOptions.map(option => option.value) : []
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
          message: '请选择输出字段以继续',
        })
      }
      else {
        if (formData.processMode.onlyProcessSelected === false) {
          if (formData.fieldId.keyword === '') {
            allDisabled.value = false
            await bitable.ui.showToast({
              toastType: ToastType.warning,
              message: '请选择企业信息关键词字段以继续',
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
        message: '请选择输出项以继续',
      })
    }
  }
  else {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.warning,
      message: '请粘贴AppCode以继续',
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
      message: '请先在左侧多维表格中选中单元格',
    })
    return
  }
  const fieldMeta = await table.getFieldMetaById(fieldId)
  if (fieldMeta.type !== FieldType.Text) {
    allDisabled.value = false
    await bitable.ui.showToast({
      toastType: ToastType.error,
      message: '请选中文本类型字段下的单元格',
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
  const fieldMap: Record<string, string> = {
    companyName: formData.fieldId.companyName,
    companyCode: formData.fieldId.companyCode,
    legalPerson: formData.fieldId.legalPerson,
    creditNo: formData.fieldId.creditNo,
  }

  for (const checkbox of formData.checkbox) {
    if (Object.prototype.hasOwnProperty.call(fieldMap, checkbox)) {
      const fieldId = fieldMap[checkbox]
      const textField = await table.getField<ITextField>(fieldId)
      await textField.setValue(value, company[checkbox as keyof CompanyResp])
      break
    }
  }

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
      label="处理模式"
    >
      <a-space direction="vertical">
        <a-radio-group
          v-model="formData.processMode.autoProcess"
          type="button"
        >
          <a-radio :value="true">
            自动选择
            <InfoTip content="自动选择最匹配企业名称关键词的公司，适合关键词较精确或名称相似企业较少情况" />
          </a-radio>
          <a-radio :value="false">
            手动选择
            <InfoTip content="遇到有两个以上符合关键词要求的公司则弹出对话框手动确认公司，适合关键词更模糊或名称相似企业较多情况" />
          </a-radio>
        </a-radio-group>
        <a-radio-group
          v-model="formData.processMode.onlyProcessSelected"
          type="button"
        >
          <a-radio :value="false">
            处理整列
          </a-radio>
          <a-radio :value="true">
            仅处理选中行
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
    <a-form-item>
      <a-space
        direction="vertical"
        fill
      >
        <a-checkbox
          :model-value="checkAll"
          :indeterminate="indeterminate"
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
    <div>
      <a-form-item
        v-if="formData.checkbox.includes('companyName')"
        field="outputCompanyNameField"
        label="输出企业名称字段"
      >
        <a-select
          v-model="formData.fieldId.companyName"
          placeholder="请选择期望输出企业名称的字段"
        >
          <a-option
            v-for="meta in textFieldOptions"
            :key="meta.id"
            :value="meta.id"
            :label="meta.name"
          />
        </a-select>
      </a-form-item>
      <a-form-item
        v-if="formData.checkbox.includes('creditNo')"
        field="outputCreditNoField"
        label="输出统一社会信用代码字段"
      >
        <a-select
          v-model="formData.fieldId.creditNo"
          placeholder="请选择期望输出统一社会信用代码的字段"
        >
          <a-option
            v-for="meta in textFieldOptions"
            :key="meta.id"
            :value="meta.id"
            :label="meta.name"
          />
        </a-select>
      </a-form-item>
      <a-form-item
        v-if="formData.checkbox.includes('companyCode')"
        field="outputCompanyCodeField"
        label="输出注册号字段"
      >
        <a-select
          v-model="formData.fieldId.companyCode"
          placeholder="请选择期望输出注册号的字段"
        >
          <a-option
            v-for="meta in textFieldOptions"
            :key="meta.id"
            :value="meta.id"
            :label="meta.name"
          />
        </a-select>
      </a-form-item>
      <a-form-item
        v-if="formData.checkbox.includes('legalPerson')"
        field="outputLegalPersonField"
        label="输出法人字段"
      >
        <a-select
          v-model="formData.fieldId.legalPerson"
          placeholder="请选择期望输出法人的字段"
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
        需手动选择
      </a-typography-title>
    </template>
    <div>
      <a-space
        direction="vertical"
        fill
      >
        <div>
          找到符合关键词「
          <a-typography-text bold>
            {{ drawerName }}
          </a-typography-text>
          」的多个企业，请选择最匹配的企业以写入多维表格
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
