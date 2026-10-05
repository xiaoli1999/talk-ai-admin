<template>
    <el-scrollbar class="survey page">
        <!-- 顶部:返回 + 标题 + 云端版本戳 | 更新时间 + 刷新(布局照 drama.vue 页头) -->
        <div class="hd">
            <div class="hd-l">
                <el-button :icon="ArrowLeft" @click="goHome">首页</el-button>
                <span class="tt">问卷</span>
                <el-tag size="small" type="info" effect="plain">各期答卷 · 本期总结 / 填写明细</el-tag>
                <el-tag size="small" :type="build ? 'success' : 'danger'" effect="plain" title="drama-admin 云对象 BUILD(上传核验戳)">
                    云端 {{ build || '未连通' }}
                </el-tag>
            </div>
            <div class="hd-r">
                <span v-if="lastUpdate" class="upd">更新于 {{ lastUpdate }}</span>
                <el-button type="primary" :loading="loading" @click="load">🔄 刷新</el-button>
            </div>
        </div>

        <!-- 降级提示:题目定义接口没上线时题干/选项退化成题号/字母,页面其余照常 -->
        <el-alert v-if="archiveMissing" class="tip" type="warning" show-icon :closable="false"
            title="题目定义接口未上线(survey.getArchive),题干与选项暂以题号/字母显示;重传 survey 云对象后自动恢复" />
        <el-alert v-if="ovErr" class="tip" type="error" show-icon :closable="false" :title="`答卷概览加载失败:${ovErr}`">
            <el-button size="small" type="danger" plain @click="load">重试</el-button>
        </el-alert>

        <!-- 期卡片:新 → 旧,一行横滑不换行 -->
        <div v-loading="loading && !versions.length" class="periods">
            <el-scrollbar v-if="versions.length">
                <div class="pc-row">
                    <div
                        v-for="v in versions"
                        :key="v.version"
                        class="pc"
                        :class="{ on: cur && v.version === cur.version, nil: !v.total }"
                        @click="pick(v)"
                    >
                        <!-- 期号 + 填写人数(大数字)同一行;标题;时效 + 状态同一行 -->
                        <div class="pc-hd">
                            <span class="pc-lb">{{ v.label }}</span>
                            <el-tag v-if="v.isCurrent" size="small" effect="plain" round>当前</el-tag>
                            <span class="pc-n"><b>{{ v.total.toLocaleString('en-US') }}</b><i>份</i></span>
                        </div>
                        <div class="pc-tt" :class="{ none: !v.title }" :title="v.title">{{ v.title || '未登记标题' }}</div>
                        <div class="pc-ft">
                            <span class="pc-date">{{ dateText(v) }}</span>
                            <el-tag v-if="v.status" size="small" :type="STATUS_TAG[v.status] || 'info'" effect="light" round>{{ v.status }}</el-tag>
                        </div>
                        <div v-if="archive && !v.hasDef" class="pc-warn">无题目定义</div>
                    </div>
                </div>
            </el-scrollbar>
            <el-empty v-else-if="!loading" description="还没有任何一期问卷" :image-size="80">
                <el-button type="primary" @click="load">重新加载</el-button>
            </el-empty>
        </div>

        <!-- 分段:本期总结 / 填写明细;key 带刷新序号,切期或点刷新都重建面板重新拉数 -->
        <template v-if="cur">
            <div class="bar">
                <el-radio-group v-model="tab">
                    <el-radio-button value="summary">本期总结</el-radio-button>
                    <el-radio-button value="answers">填写明细<span>（{{ cur.total }}）</span></el-radio-button>
                </el-radio-group>
                <span class="bar-hint">{{ tab === 'summary' ? '点任一选项条,直接跳到「填写明细」看选了它的答卷' : `${cur.label}${cur.title ? ' · ' + cur.title : ''}` }}</span>
            </div>
            <summary-panel v-if="tab === 'summary'" :key="panelKey" :ver="cur" @drill="onDrill" />
            <answers-panel v-else :key="panelKey" :ver="cur" :drill="drill" @clear-drill="drill = null" />
        </template>
    </el-scrollbar>
</template>

<script setup>
/**
 * 问卷后台总页(10-05):一排「期卡片」选期 + 两个分段(本期总结 / 填写明细)。
 * 题目定义走 survey.getArchive(可能还没上线 → 降级为题号/字母),答卷数据走 drama-admin.survey*(后台 token);
 * 两条链路并行拉,mergeVersions 取并集合并,未来上新 v4/v5 不用改这里。
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { dayjs, ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getSession, goLogin } from '@/utils/auth'
import { surveyApi, fetchArchive, mergeVersions } from '@/utils/survey'
import SummaryPanel from './components/summary-panel.vue'
import AnswersPanel from './components/answers-panel.vue'

const TABS = ['summary', 'answers']
const STATUS_TAG = { 进行中: 'success', 已结束: 'info', 未开始: 'warning' }

const tab = ref('summary')
const versions = ref([])
/* 选中的版本号;null = 还没选('' 是合法值:库里没标版本的老答卷归成的一组) */
const curVer = ref(null)
const drill = ref(null)
const archive = ref(null)
const archiveMissing = ref(false)
const ovErr = ref('')
const build = ref('')
const loading = ref(false)
const lastUpdate = ref('')
/* 刷新序号:拼进面板 key,点「刷新」时两个面板跟着重建重拉(只用 version 做 key 的话刷新不会重拉) */
const seq = ref(0)
/* URL ?v=v3 指定默认期(从别处带链接跳进来用) */
let wantVer = ''

const cur = computed(() => versions.value.find((v) => v.version === curVer.value) || null)
const panelKey = computed(() => (cur.value ? `${cur.value.version}#${seq.value}` : ''))

onLoad((opt) => {
    if (opt && TABS.includes(opt.tab)) tab.value = opt.tab
    if (opt && opt.v) wantVer = String(opt.v)
})

/** 默认期:URL 指定的 > 最新一期有数据的 > 最新一期 */
const pickDefault = (list) => {
    const want = wantVer ? list.find((v) => v.version === wantVer) : null
    const hit = want || list.find((v) => v.total > 0) || list[0]
    return hit ? hit.version : null
}

const load = async () => {
    if (loading.value) return
    loading.value = true
    const [arc, ov] = await Promise.all([fetchArchive(), surveyApi('surveyOverview')])
    loading.value = false

    archive.value = arc
    archiveMissing.value = !arc
    const ok = !!(ov && !ov.errMsg && ov.data)
    ovErr.value = ok ? '' : ((ov && ov.errMsg) || '无响应')
    if (!ok) ElMessage.error(`答卷概览加载失败:${ovErr.value}`)
    build.value = ok ? (ov.data.build || '') : ''

    versions.value = mergeVersions(arc, ok ? ov.data.versions : [])
    /* 刷新后原来选的期还在就不跳,免得看到一半被切走 */
    if (!versions.value.some((v) => v.version === curVer.value)) {
        curVer.value = pickDefault(versions.value)
        drill.value = null
    }
    seq.value++
    lastUpdate.value = dayjs().format('HH:mm:ss')
}

const pick = (v) => {
    if (cur.value && v.version === cur.value.version) return
    curVer.value = v.version
    drill.value = null
}

/** 总结面板点选项条 → 带着筛选条件切到「填写明细」 */
const onDrill = (d) => {
    drill.value = d
    tab.value = 'answers'
}

const dateText = (v) => (v.startDate || v.endDate ? `${v.startDate || '?'} ~ ${v.endDate || '?'}` : '未登记时效')

/* 首页是 tabBar 页:有上一页就退回(保留首页筛选态);直接打开本页没有历史时 switchTab 兜底(tabBar 页不能 navigateTo) */
const goHome = () => (getCurrentPages().length > 1 ? uni.navigateBack() : uni.switchTab({ url: '/pages/index/index' }))

onMounted(() => {
    if (!getSession()) return goLogin()
    load()
})
</script>

<style lang="scss" scoped>
.survey {
    .hd {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 14px;
        .hd-l { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            .tt { font-size: 18px; font-weight: 700; }
        }
        .hd-r { display: flex; align-items: center; gap: 12px;
            .upd { font-size: 12px; color: #909399; }
        }
    }
    .tip { margin-bottom: 12px; }

    .periods { min-height: 60px; margin-bottom: 14px; }
    .pc-row { display: flex; flex-wrap: nowrap; gap: 12px; padding: 2px 2px 12px; }
    .pc {
        flex: 0 0 264px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: #fff;
        border: 1px solid #ebeef5;
        border-radius: 10px;
        padding: 12px 14px;
        cursor: pointer;
        transition: border-color .15s, box-shadow .15s, background .15s;
        &:hover { border-color: #c6e2ff; }
        &.on { border-color: #409eff; background: linear-gradient(180deg, #f0f7ff 0%, #fff 70%); box-shadow: 0 2px 10px rgba(64, 158, 255, .15); }
        .pc-hd { display: flex; align-items: center; gap: 6px; min-height: 30px;
            .pc-lb { font-size: 13px; font-weight: 600; color: #303133; white-space: nowrap; }
        }
        .pc-n { margin-left: auto; flex: 0 0 auto; line-height: 1; white-space: nowrap;
            b { font-size: 28px; font-weight: 700; color: #303133; font-variant-numeric: tabular-nums; }
            i { font-style: normal; font-size: 12px; color: #909399; margin-left: 2px; }
        }
        .pc-tt { font-size: 13px; color: #606266; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            &.none { color: #c0c4cc; }
        }
        .pc-ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .pc-date { font-size: 12px; color: #909399; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-warn { font-size: 12px; color: #e6a23c; margin-top: -2px; }
        &.on .pc-n b { color: #409eff; }
        &.nil .pc-n b { color: #c0c4cc; }
    }

    .bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
        .bar-hint { font-size: 12px; color: #c0c4cc; }
    }
}
</style>
