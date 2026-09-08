<template>
    <el-scrollbar class="drama page">
        <!-- 顶部:标题 + 线上版本戳 + 分段 -->
        <div class="hd">
            <div class="hd-l">
                <span class="tt">小剧场监控</span>
                <el-tag size="small" type="info" effect="plain">体验版内测 · 自由本审核 / 举报 / 错误 / 钱账</el-tag>
                <el-tag size="small" :type="build ? 'success' : 'danger'" effect="plain" :title="'drama-admin 云对象 BUILD(上传核验戳)'">
                    云端 {{ build || '未连通' }}
                </el-tag>
            </div>
            <el-radio-group v-model="tab" @change="onTab">
                <el-radio-button value="scripts">自由本<span v-if="badges.scripts != null">（{{ badges.scripts }} 待审）</span></el-radio-button>
                <el-radio-button value="reports">举报<span v-if="badges.reports != null">（{{ badges.reports }} 待处理）</span></el-radio-button>
                <el-radio-button value="errors">错误</el-radio-button>
                <el-radio-button value="money">钱账</el-radio-button>
            </el-radio-group>
        </div>

        <!-- 四个分段各自拉数;keep-alive 保留筛选态,切回不重拉 -->
        <keep-alive>
            <scripts-panel v-if="tab === 'scripts'" key="scripts" @badge="badges.scripts = $event" />
            <reports-panel v-else-if="tab === 'reports'" key="reports" @badge="badges.reports = $event" />
            <errors-panel v-else-if="tab === 'errors'" key="errors" />
            <money-panel v-else key="money" />
        </keep-alive>
    </el-scrollbar>
</template>

<script setup>
/**
 * 小剧场监控总页(09-08 黎令:首页只加一个入口,进来是一页四分段)。
 * 数据全部经云对象 drama-admin(drama_* 表 clientDB 全关,后台页不能 JQL 直查);登录态 = admin_session。
 */
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getSession, goLogin } from '@/utils/auth'
import { dramaPing } from '@/utils/drama'
import ScriptsPanel from './components/scripts-panel.vue'
import ReportsPanel from './components/reports-panel.vue'
import ErrorsPanel from './components/errors-panel.vue'
import MoneyPanel from './components/money-panel.vue'

const TABS = ['scripts', 'reports', 'errors', 'money']
const tab = ref('scripts')
const build = ref('')
const badges = reactive({ scripts: null, reports: null })

onLoad((opt) => { if (opt && TABS.includes(opt.tab)) tab.value = opt.tab })

const onTab = () => { /* 分段切换本身无副作用;留钩子给后续埋点 */ }

onMounted(async () => {
    if (!getSession()) return goLogin()
    const r = await dramaPing()
    build.value = (r && r.data && r.data.build) || ''
})
</script>

<style lang="scss" scoped>
.drama {
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
    }
}
</style>
