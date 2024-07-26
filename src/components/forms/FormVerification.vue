<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IFieldMeta } from '@lark-base-open/js-sdk'
import { FieldType, bitable } from '@lark-base-open/js-sdk'
import InfoTip from '@/components/utils/InfoTip.vue'

const { t } = useI18n()

const formData = reactive({
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
    creditNo: '',
    companyCode: '',
    legalPerson: '',
    companyStatus: '',
    establishDate: '',
  },
})
const textFieldOptions = ref<IFieldMeta[]>([])
const textNumberFieldOptions = ref<IFieldMeta[]>([])
const dateFieldOptions = ref<IFieldMeta[]>([])

const checkboxOptions = [
  { value: 'companyName', label: 'labels.checkbox_group.companyName' },
  { value: 'creditNo', label: 'labels.checkbox_group.creditNo' },
  { value: 'companyCode', label: 'labels.checkbox_group.companyCode' },
  { value: 'legalPerson', label: 'labels.checkbox_group.legalPerson' },
  { value: 'companyStatus', label: 'labels.checkbox_group.companyStatus' },
  { value: 'establishDate', label: 'labels.checkbox_group.establishDate' },
]
const checkAll = computed(() => checkboxOptions.length === formData.checkbox.length)
const indeterminate = computed(() => !!(checkboxOptions.length > formData.checkbox.length && formData.checkbox.length))

const isLoading = ref(false)
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
const drawerTableData = reactive([])
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
  textNumberFieldOptions.value = fieldMetaList.filter(item => item.type === FieldType.Text || item.type === FieldType.Number)
  textNumberFieldOptions.value = fieldMetaList.filter(item => item.type === FieldType.DateTime)
}

function handleSelectAll(value: string) {
  formData.checkbox = value ? checkboxOptions.map(option => option.value) : []
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
    :disabled="isLoading"
  >
    <a-form-item
      field="serviceType"
      :label="t('labels.service_type')"
    >
      <a-radio-group
        v-model="formData.serviceType"
        type="button"
        size="small"
      >
        <a-radio value="shumai">
          {{ t('text.type_shumai') }}
        </a-radio>
        <a-radio value="shulian">
          {{ t('text.type_shulian') }}
        </a-radio>
        <a-radio value="jmzs">
          阿里云聚美智树
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
        label="补全输出企业名称字段"
      >
        <a-select
          v-model="formData.fieldId.companyName"
          placeholder="请选择期望补全输出企业名称的字段"
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
        label="补全输出统一社会信用代码字段"
      >
        <a-select
          v-model="formData.fieldId.creditNo"
          placeholder="请选择期望补全输出统一社会信用代码的字段"
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
        label="补全输出注册号字段"
      >
        <a-select
          v-model="formData.fieldId.creditNo"
          placeholder="请选择期望补全输出注册号的字段"
        >
          <a-option
            v-for="meta in textNumberFieldOptions"
            :key="meta.id"
            :value="meta.id"
            :label="meta.name"
          />
        </a-select>
      </a-form-item>
      <a-form-item
        v-if="formData.checkbox.includes('legalPerson')"
        field="outputLegalPersonField"
        label="补全输出法定代表人字段"
      >
        <a-select
          v-model="formData.fieldId.legalPerson"
          placeholder="请选择期望补全输出法定代表人的字段"
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
        v-if="formData.checkbox.includes('companyStatus')"
        field="outputCompanyStatusField"
        label="补全输出经营状态字段"
      >
        <a-select
          v-model="formData.fieldId.legalPerson"
          placeholder="请选择期望补全输出经营状态的字段"
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
        v-if="formData.checkbox.includes('establishDate')"
        field="outputEstablishDateField"
        label="补全输出登记日期字段"
      >
        <a-select
          v-model="formData.fieldId.legalPerson"
          placeholder="请选择期望补全输出登记日期的字段"
        >
          <a-option
            v-for="meta in dateFieldOptions"
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
    :width="315"
    :footer="false"
    :closable="false"
    :hide-cancel="true"
    :esc-to-close="false"
    :mask-closable="false"
    :visible="visibleSelectDrawer"
  >
    <template #title>
      <a-typography-title :heading="6">
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
        >
          <template #footer>
            <a-space>
              <a-button type="primary">
                确认
              </a-button>
              <a-button>跳过，本次不处理</a-button>
            </a-space>
          </template>
        </a-table>
      </a-space>
    </div>
  </a-drawer>
</template>
