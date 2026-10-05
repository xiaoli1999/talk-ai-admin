<template>
    <el-drawer v-model="visible" size="min(560px, 100vw)" append-to-body class="ad-drawer">
        <!-- 头部:谁填的 -->
        <template #header>
            <div v-if="row" class="ad-hd">
                <el-avatar :size="44" :src="u.avatar || undefined" class="ad-av">
                    <span v-if="u.nickname">{{ String(u.nickname).slice(0, 1) }}</span>
                    <el-icon v-else :size="22"><UserFilled /></el-icon>
                </el-avatar>
                <div class="ad-hd-t">
                    <div class="ad-nk">
                        <span class="nk" :class="{ none: !u.nickname }">{{ u.nickname || '未设置昵称' }}</span>
                        <span v-if="GENDER[u.gender]" class="gd" :class="'g' + u.gender">{{ GENDER[u.gender] }}</span>
                        <id-copy :id="row.user_id || u._id || ''" label="uid" />
                        <id-copy :id="row._id || ''" label="答卷" />
                    </div>
                    <div class="ad-sub">
                        <span class="seg">注册 {{ fmtTime(u.register_date).slice(0, 10) }}</span><span class="seg"> · 最近登录 {{ fmtTime(u.last_login_date) }}</span><span class="seg"> · 聊天 {{ num(u.chat_total) }} 次 · 登录 {{ num(u.login_count) }} 次</span>
                    </div>
                </div>
            </div>
            <span v-else class="ad-tt">答卷详情</span>
        </template>

        <div ref="bodyRef" class="ad">
            <template v-if="row">
                <!-- 填写信息 -->
                <div class="meta">
                    <div class="mi"><span class="mk">提交时间</span><span class="mv num">{{ fmtTime(row.time) }}</span></div>
                    <div class="mi">
                        <span class="mk">用时</span><span class="mv num" :class="{ warn: fast }">{{ fmtDuration(row.duration) }}</span>
                        <el-tag v-if="fast" type="warning" size="small" disable-transitions>过快</el-tag>
                    </div>
                    <div class="mi"><span class="mk">来源</span><span class="mv" :class="{ dim: !row.source }">{{ row.source || '—' }}</span></div>
                    <div class="mi">
                        <span class="mk">付费</span>
                        <template v-if="u.pay_total > 0"><span class="mv pay">{{ yuan(u.pay_total) }} 元</span><span class="dim">· {{ u.pay_count || 0 }} 次</span><span v-if="vip" class="vip">会员</span></template>
                        <el-tag v-else type="info" size="small" effect="plain" disable-transitions class="unpaid">未付费</el-tag>
                    </div>
                    <div class="mi">
                        <span class="mk">微信</span>
                        <template v-if="u.wechat_id">
                            <span class="mv sel" :title="u.wechat_id">{{ u.wechat_id }}</span>
                            <el-button link size="small" class="cp" :icon="CopyDocument" title="复制微信号" @click="copy(u.wechat_id, '微信号')" />
                        </template>
                        <span v-else class="mv dim">—</span>
                    </div>
                    <div class="mi">
                        <span class="mk">手机</span>
                        <template v-if="u.beta_phone">
                            <span class="mv sel num">{{ u.beta_phone }}</span>
                            <el-button link size="small" class="cp" :icon="CopyDocument" title="复制手机号" @click="copy(u.beta_phone, '手机号')" />
                        </template>
                        <span v-else class="mv dim">—</span>
                    </div>
                </div>

                <el-alert v-if="!ver.hasDef" type="warning" :closable="false" show-icon title="这一期缺少题目定义：题干只显示题号，选项只显示字母" class="ad-alert" />

                <!-- 完整答卷:有 PART 分段按段分组;定义之外的答案字段归到末尾「其他字段」 -->
                <div v-for="g in groups" :key="g.key" class="sec">
                    <div v-if="g.eyebrow || g.title" class="sec-hd" :class="{ extra: g.key === 'extra' }">
                        <div v-if="g.eyebrow" class="sec-eb">{{ g.eyebrow }}</div>
                        <div v-if="g.title" class="sec-tt">{{ g.title }}</div>
                    </div>
                    <div v-for="it in g.items" :key="it.id" class="qa" :class="{ blank: it.kind === 'empty' }">
                        <div class="qa-hd">
                            <span class="qa-no">{{ it.no }}</span>
                            <span v-if="it.typeLabel" class="qa-ty">{{ it.typeLabel }}</span>
                            <span v-if="it.isContact" class="qa-ty ct">联系方式</span>
                            <span v-if="it.type === 'checkbox' && it.kind === 'choice'" class="qa-cnt">选了 {{ it.items.length }} 项</span>
                        </div>
                        <div v-if="it.title" class="qa-tt">{{ it.title }}</div>

                        <!-- 选择题 · 有定义:列全部选项,选中的高亮,没选的灰显 -->
                        <div v-if="it.kind === 'choice' && it.full" class="opts">
                            <div v-for="(o, i) in it.opts" :key="i" class="op" :class="{ on: o.on, multi: it.type === 'checkbox' }">
                                <div class="op-row">
                                    <span class="op-mk"><el-icon v-if="o.on && it.type === 'checkbox'"><Check /></el-icon></span>
                                    <span v-if="o.key" class="op-k">{{ o.key }}</span>
                                    <span class="op-l">{{ o.label }}<span v-if="o.stray" class="stray">定义里没有这个选项</span></span>
                                </div>
                                <div v-if="o.extra" class="quote sm">{{ o.extra }}</div>
                            </div>
                        </div>
                        <!-- 选择题 · 无定义:只列用户选的字母 -->
                        <div v-else-if="it.kind === 'choice'" class="chips">
                            <div v-for="(o, i) in it.opts" :key="i" class="chip-w">
                                <span class="chip">{{ o.key || o.label }}<template v-if="o.key && o.label"> · {{ o.label }}</template></span>
                                <div v-if="o.extra" class="quote sm">{{ o.extra }}</div>
                            </div>
                        </div>
                        <!-- 问答:原文,保留换行 -->
                        <div v-else-if="it.kind === 'text'" class="ans-text">
                            <div class="quote">{{ it.text }}</div>
                            <el-button v-if="it.isContact" link size="small" class="cp" :icon="CopyDocument" title="复制" @click="copy(it.text, '联系方式')" />
                        </div>
                        <div v-else class="none">未作答</div>
                    </div>
                </div>
                <el-empty v-if="!groups.length" description="这份答卷没有任何答案字段" :image-size="60" />
            </template>
            <el-empty v-else description="没有选中的答卷" :image-size="60" />
        </div>

        <!-- 底部:在当前页列表内切换上一份 / 下一份,到头禁用 -->
        <template #footer>
            <div class="ad-ft">
                <el-button :disabled="!hasPrev" :icon="ArrowLeft" @click="emit('prev')">上一份</el-button>
                <div class="pos">
                    <span v-if="index >= 0 && count">本页第 <b>{{ index + 1 }}</b> / {{ count }} 份</span>
                    <span class="kbd">← → 键也能切换</span>
                </div>
                <el-button :disabled="!hasNext" @click="emit('next')">下一份<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button>
            </div>
        </template>
    </el-drawer>
</template>

<script setup>
/**
 * 问卷后台 · 单份答卷详情抽屉(填写明细面板用)。
 * 头部 = 填写人与填写信息;正文 = buildSheet 解出的逐题视图,按 PART 分段;选择题列出全部选项、高亮选中项,
 * 让人一眼看出「在哪些选项里选了哪个」,比只看选中文本更能读出倾向。
 * 上一份 / 下一份只发事件,由列表面板在当前页内移动下标(抽屉不关心分页)。
 */
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled, CopyDocument, Check, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { optionList, buildSheet, fmtDuration, fmtTime } from '@/utils/survey'
import { copyText } from '@/utils/common'
import { genderEnums } from '@/config/enums'
import IdCopy from '@/pages/drama/components/id-copy.vue'

const props = defineProps({
    /* 显隐(v-model) */
    modelValue: { type: Boolean, default: false },
    /* surveyAnswers 列表行 */
    row: { type: Object, default: null },
    /* 当前期(mergeVersions 的一项) */
    ver: { type: Object, required: true },
    /* 本行在当前页列表里的下标与当前页条数:决定上一份 / 下一份是否可点 */
    index: { type: Number, default: -1 },
    count: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue', 'prev', 'next'])

const FAST_SEC = 60
const GENDER = { 1: genderEnums[1], 2: genderEnums[2] }

const bodyRef = ref(null)
const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const u = computed(() => (props.row && props.row.user) || {})
const fast = computed(() => { const d = Number(props.row && props.row.duration) || 0; return d > 0 && d < FAST_SEC })
const hasPrev = computed(() => props.index > 0)
const hasNext = computed(() => props.index >= 0 && props.index < props.count - 1)

/** 分 → 元:按约定保留到元;不足 1 元的小额单(测试单)显示 <1 */
const yuan = (fen) => { const v = Math.round((Number(fen) || 0) / 100); return v > 0 ? String(v) : '<1' }
/** 计数千分位,缺省按 0 */
const num = (n) => (Number(n) || 0).toLocaleString('en-US')
/* 会员标与列表口径一致:付过费且会员未到期 */
const vip = computed(() => (Number(u.value.pay_total) || 0) > 0 && (Number(u.value.vip_end_time) || 0) > Date.now())
const pickLabel = (x) => (x.label && x.label !== x.key ? x.label : '')

/**
 * 选择题 → 逐选项行。有定义:全部选项按字母序列出,标出选中与补充文字;
 * 答案里有、定义里没有的(题目改过选项数 / 混进非字母的脏值)追加在后并标注,宁可难看也不丢数据。
 * 无定义:只列用户选的。
 */
const choiceRows = (it, defs) => {
    const items = it.items || []
    if (!defs.length) return items.map((x) => ({ key: x.key, label: pickLabel(x), extra: x.extra || '', on: true, stray: false }))
    const picked = new Map()
    items.forEach((x) => { if (x.key && !picked.has(x.key)) picked.set(x.key, x) })
    const known = new Set(defs.map((o) => o.key))
    const out = defs.map((o) => {
        const p = picked.get(o.key)
        return { key: o.key, label: o.label, extra: (p && p.extra) || '', on: !!p, stray: false }
    })
    items.forEach((x) => { if (!x.key || !known.has(x.key)) out.push({ key: x.key, label: pickLabel(x), extra: x.extra || '', on: true, stray: true }) })
    return out
}

/* 逐题视图 + 选项行;题目定义出问题时退化成空卷,不让抽屉渲染崩掉 */
const sheet = computed(() => {
    if (!props.row) return []
    let list = []
    try { list = buildSheet(props.ver, props.row.answers) || [] } catch (e) { console.warn('[answer-drawer] buildSheet 失败', e) }
    const qmap = props.ver.qmap || {}
    return list.map((it) => {
        const defs = it.kind === 'choice' ? optionList(qmap[it.id]) : []
        return { ...it, full: defs.length > 0, opts: it.kind === 'choice' ? choiceRows(it, defs) : [] }
    })
})

/*
 * 分组:有 sections 按 PART 分;定义里有但没落进任何 PART 的归「其余题目」;定义之外的 key 归末尾「其他字段」。
 * 整期无定义时不分组(全是定义外的 key,再套一个「其他字段」标题反而误导,顶部已有提示条)。
 */
const groups = computed(() => {
    const list = sheet.value
    if (!list.length) return []
    if (!props.ver.hasDef) return [{ key: 'all', eyebrow: '', title: '', items: list }]
    const qmap = props.ver.qmap || {}
    const byId = new Map(list.map((it) => [it.id, it]))
    const used = new Set()
    const out = []
    const secs = Array.isArray(props.ver.sections) ? props.ver.sections : []
    secs.forEach((s, i) => {
        const items = (s.qids || []).map((id) => byId.get(id)).filter((it) => it && !used.has(it.id))
        items.forEach((it) => used.add(it.id))
        if (items.length) out.push({ key: 's' + i, eyebrow: s.eyebrow || '', title: s.title || '', items })
    })
    const rest = list.filter((it) => !used.has(it.id))
    const restDef = rest.filter((it) => qmap[it.id])
    const extra = rest.filter((it) => !qmap[it.id])
    if (restDef.length) out.push({ key: 'rest', eyebrow: '', title: out.length ? '其余题目' : '', items: restDef })
    if (extra.length) out.push({ key: 'extra', eyebrow: '', title: '其他字段', items: extra })
    return out
})

const copy = async (text, label) => {
    if (!text) return
    const ok = await copyText(String(text)).catch(() => false)
    ElMessage[ok ? 'success' : 'error'](ok ? `已复制${label}：${text}` : '复制失败')
}

/* 切到另一份时正文回到顶部(滚动容器是 el-drawer__body,即 bodyRef 的父节点) */
watch(() => props.row, () => nextTick(() => {
    const box = bodyRef.value && bodyRef.value.parentElement
    if (box) box.scrollTop = 0
}))

/* ← → 切上一份 / 下一份:连续审一页答卷时不用来回找按钮;输入框里按方向键不拦 */
const onKey = (e) => {
    if (!props.modelValue || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const t = e.target || {}
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable) return
    if (e.key === 'ArrowLeft' && hasPrev.value) emit('prev')
    else if (e.key === 'ArrowRight' && hasNext.value) emit('next')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style lang="scss" scoped>
.ad-hd { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;
    .ad-av { flex: 0 0 44px; background: #ecf5ff; color: #409eff; font-size: 18px; }
    .ad-hd-t { min-width: 0; flex: 1; }
    .ad-nk { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
    .nk { font-size: 16px; font-weight: 700; color: #303133; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        &.none { color: #c0c4cc; font-weight: 500; }
    }
    .ad-sub { font-size: 12px; color: #909399; margin-top: 2px; font-variant-numeric: tabular-nums; line-height: 1.6; }
    /* 一段不拆开,窄抽屉里只在「 · 」处换行 */
    .seg { white-space: nowrap; }
}
.ad-tt { font-size: 16px; font-weight: 700; color: #303133; }
.gd { flex: 0 0 auto; font-size: 11px; line-height: 16px; padding: 0 4px; border-radius: 3px;
    &.g1 { color: #409eff; background: #ecf5ff; }
    &.g2 { color: #f56c6c; background: #fef0f0; }
}
.cp { flex: 0 0 auto; height: 18px; padding: 0 2px; color: #909399; &:hover { color: #409eff; } }
.dim { font-size: 12px; color: #909399; }
.num { font-variant-numeric: tabular-nums; }

.ad {
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; background: #f7f8fa; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
    .mi { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; line-height: 24px; }
    .mk { flex: 0 0 52px; font-size: 12px; color: #909399; }
    .mv { color: #303133; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        &.warn { color: #e6a23c; font-weight: 600; }
        &.pay { color: #67c23a; font-weight: 600; }
        &.sel { user-select: all; }
        &.dim { color: #c0c4cc; }
    }
    .unpaid { opacity: .7; }
    .vip { flex: 0 0 auto; font-size: 10px; font-weight: 600; line-height: 15px; padding: 0 4px; border-radius: 3px; color: #b88230; background: #fdf6ec; border: 1px solid #f5dab1; }
    .ad-alert { margin-bottom: 14px; }

    .sec { margin-bottom: 18px; }
    .sec-hd { margin: 0 0 10px; padding-left: 10px; border-left: 3px solid #409eff;
        &.extra { border-left-color: #c0c4cc; }
    }
    .sec-eb { font-size: 11px; font-weight: 600; letter-spacing: .06em; color: #409eff; line-height: 1.6; }
    .sec-tt { font-size: 14px; font-weight: 600; color: #303133; line-height: 1.5; }

    .qa { padding: 12px 14px; border: 1px solid #ebeef5; border-radius: 8px; margin-bottom: 10px; background: #fff;
        &.blank { background: #fafafa; border-style: dashed; }
    }
    .qa-hd { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .qa-no { font-size: 12px; font-weight: 700; color: #fff; background: #409eff; border-radius: 4px; padding: 0 6px; line-height: 18px; font-variant-numeric: tabular-nums; }
    .qa-ty { font-size: 11px; color: #909399; background: #f4f4f5; border-radius: 3px; padding: 0 5px; line-height: 18px;
        &.ct { color: #67c23a; background: #f0f9eb; }
    }
    .qa-cnt { margin-left: auto; font-size: 11px; color: #909399; }
    .qa-tt { font-size: 14px; line-height: 1.6; color: #303133; margin-bottom: 8px; white-space: pre-wrap; word-break: break-word; }

    /* 选项行:选中 = 主色浅底 + 实心标记;未选 = 灰字 */
    .opts { display: flex; flex-direction: column; gap: 4px; }
    .op { border: 1px solid transparent; border-radius: 6px; padding: 5px 10px; color: #a8abb2;
        &.on { background: #ecf5ff; border-color: #c6e2ff; color: #303133; }
    }
    .op-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 20px; }
    .op-mk { flex: 0 0 14px; width: 14px; height: 14px; margin-top: 3px; box-sizing: border-box; border: 1px solid #dcdfe6; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 10px;
    }
    .op.multi .op-mk { border-radius: 3px; }
    .op.on .op-mk { background: #409eff; border-color: #409eff; }
    .op.on:not(.multi) .op-mk::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #fff; }
    .op-k { flex: 0 0 auto; min-width: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .op.on .op-k { color: #409eff; }
    .op-l { flex: 1; min-width: 0; word-break: break-word; }
    .op.on .op-l { font-weight: 500; }
    .stray { margin-left: 6px; font-size: 11px; color: #e6a23c; font-weight: 400; }

    .chips { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .chip-w { max-width: 100%; }
    .chip { display: inline-block; max-width: 100%; font-size: 13px; font-weight: 600; color: #409eff; background: #ecf5ff; border: 1px solid #c6e2ff; border-radius: 4px; padding: 0 8px; line-height: 22px; word-break: break-word; }

    /* 用户自己写的字(问答原文 / 「其他」补充)统一用暖色引用块,与自由本愿望原文同一视觉语言 */
    .quote { font-size: 13px; line-height: 1.7; color: #303133; background: #fdf6ec; border-left: 3px solid #e6a23c; border-radius: 4px; padding: 8px 12px; white-space: pre-wrap; word-break: break-word;
        &.sm { margin: 6px 0 2px 22px; padding: 4px 10px; font-size: 12px; border-left-width: 2px; }
    }
    .chips .quote.sm { margin-left: 0; }
    .ans-text { display: flex; align-items: flex-start; gap: 4px;
        .quote { flex: 1; min-width: 0; }
        .cp { margin-top: 8px; }
    }
    .none { font-size: 13px; color: #c0c4cc; }
}

.ad-ft { display: flex; align-items: center; justify-content: space-between; gap: 10px;
    .pos { display: flex; flex-direction: column; align-items: center; font-size: 12px; color: #909399; line-height: 1.5;
        b { color: #303133; font-variant-numeric: tabular-nums; }
    }
    .kbd { font-size: 11px; color: #c0c4cc; }
}
</style>

<style lang="scss">
/* el-drawer 经 append-to-body 传送到 body 下,它自己的 header / body / footer 不吃 scoped 样式;用专属类名收口,不影响其他抽屉 */
.ad-drawer {
    .el-drawer__header { margin-bottom: 0; padding: 14px 20px 12px; border-bottom: 1px solid #ebeef5; }
    .el-drawer__body { padding: 16px 20px 24px; }
    .el-drawer__footer { padding: 10px 20px; border-top: 1px solid #ebeef5; }
}
</style>
