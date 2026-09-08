<template>
    <div ref="rootRef" class="mc">
        <div v-if="title" class="mc-hd"><span class="mc-t">{{ title }}</span><span v-if="subtitle" class="mc-s">{{ subtitle }}</span></div>

        <!-- 折线:单轴,多序列同单位;悬停十字线 + 提示 -->
        <template v-if="type === 'line'">
            <!-- 刻度文字用 HTML 层叠而不是 SVG <text>:uni-app 会把 <text> 编译成内置 uni-text 组件,塞进 SVG 不渲染(09-09 实测) -->
            <div class="mc-plot" :style="{ height: height + 'px' }" @mousemove="onMove" @mouseleave="hover = -1">
                <svg :width="w" :height="height" :viewBox="`0 0 ${w} ${height}`" class="mc-svg">
                    <line v-for="(tk, i) in ticks" :key="'g' + i" :x1="pad.l" :x2="w - pad.r" :y1="yOf(tk)" :y2="yOf(tk)" class="mc-grid" />
                    <path v-for="s in series" :key="s.name" :d="pathOf(s)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                    <g v-if="hover >= 0">
                        <line :x1="xOf(hover)" :x2="xOf(hover)" :y1="pad.t" :y2="height - pad.b" class="mc-cross" />
                        <circle v-for="s in series" :key="'c' + s.name" :cx="xOf(hover)" :cy="yOf(val(s, hover))" r="4" :fill="s.color" stroke="#fff" stroke-width="2" />
                    </g>
                </svg>
                <span v-for="(tk, i) in ticks" :key="'yl' + i" class="mc-tick mc-ytick" :style="{ top: (yOf(tk) - 7) + 'px', width: (pad.l - 6) + 'px' }">{{ fmtNum(tk) }}</span>
                <span v-for="(lb, i) in xLabels" :key="'xl' + i" class="mc-tick mc-xtick" :style="{ left: lb.x + 'px', top: (height - pad.b + 4) + 'px' }">{{ lb.text }}</span>
                <div v-if="hover >= 0" class="mc-tip" :style="tipStyle">
                    <div class="mc-tip-l">{{ labels[hover] }}</div>
                    <div v-for="s in series" :key="'t' + s.name" class="mc-tip-r"><i :style="{ background: s.color }"></i>{{ s.name }}<b>{{ fmtNum(val(s, hover)) }}{{ unit }}</b></div>
                </div>
            </div>
            <div v-if="series.length > 1" class="mc-legend"><span v-for="s in series" :key="'l' + s.name"><i :style="{ background: s.color }"></i>{{ s.name }}</span></div>
        </template>

        <!-- 横条:分布/构成,按最大值等比,值与占比直接标出(调色板里三色对底面对比不足 3:1,所以必须直标) -->
        <template v-else-if="type === 'hbar'">
            <div v-if="items.length" class="mc-bars">
                <div v-for="(it, i) in items" :key="it.label" class="mc-bar">
                    <span class="mc-bl" :title="it.label">{{ it.label }}</span>
                    <div class="mc-bt"><div class="mc-bf" :style="{ width: barPct(it.value) + '%', background: it.color || CHART_PALETTE[i % CHART_PALETTE.length] }"></div></div>
                    <span class="mc-bv">{{ fmtNum(it.value) }}{{ unit }}<i v-if="total"> · {{ Math.round(it.value / total * 100) }}%</i></span>
                </div>
            </div>
            <div v-else class="mc-empty">{{ empty }}</div>
        </template>
    </div>
</template>

<script setup>
/**
 * 零依赖小图表(总览统计台用):line = 单轴折线(多序列须同单位,不做双轴)/ hbar = 横条分布。
 * 不引 echarts:后台工程没装图表库,几张趋势线和分布条用 SVG 手写足够,少一个依赖。
 * 规范照 dataviz:细线 2px、点 ≥8px、网格退后、悬停十字线 + 提示、≥2 序列必有图例、直标数值。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CHART_PALETTE } from '@/utils/drama'

const props = defineProps({
    type: { type: String, default: 'line' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    labels: { type: Array, default: () => [] },
    series: { type: Array, default: () => [] },   // [{ name, color, values: [] }]
    items: { type: Array, default: () => [] },    // hbar: [{ label, value, color? }]
    height: { type: Number, default: 150 },
    unit: { type: String, default: '' },
    empty: { type: String, default: '这段时间没有数据' },
})

const rootRef = ref(null)
const w = ref(600)
const hover = ref(-1)
const pad = { l: 40, r: 12, t: 10, b: 22 }

const measure = () => { if (rootRef.value) w.value = Math.max(240, rootRef.value.clientWidth) }
onMounted(() => { measure(); window.addEventListener('resize', measure) })
onUnmounted(() => window.removeEventListener('resize', measure))

const n = computed(() => props.labels.length)
const innerW = computed(() => w.value - pad.l - pad.r)
const innerH = computed(() => props.height - pad.t - pad.b)
const val = (s, i) => Number((s.values || [])[i]) || 0

/** 刻度上限取「好看的数」:1/2/4/5×10^k,最小 4,免得 0-1 的图撑满 */
const niceCeil = (m) => {
    if (!(m > 0)) return 4
    const p = Math.pow(10, Math.floor(Math.log10(m)))
    const f = m / p
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10
    return Math.max(4, nf * p)
}
const yMax = computed(() => { let m = 0; for (const s of props.series) for (let i = 0; i < n.value; i++) m = Math.max(m, val(s, i)); return niceCeil(m) })
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((r) => yMax.value * r).filter((v, i, a) => a.indexOf(v) === i))

const xOf = (i) => (n.value <= 1 ? pad.l + innerW.value / 2 : pad.l + (i * innerW.value) / (n.value - 1))
const yOf = (v) => props.height - pad.b - (v / yMax.value) * innerH.value
const pathOf = (s) => {
    let d = ''
    for (let i = 0; i < n.value; i++) d += (i === 0 ? 'M' : 'L') + xOf(i).toFixed(1) + ' ' + yOf(val(s, i)).toFixed(1) + ' '
    return d
}
const xLabels = computed(() => {
    const step = Math.max(1, Math.ceil(n.value / 6))
    const out = []
    for (let i = 0; i < n.value; i++) if (i % step === 0 || i === n.value - 1) out.push({ x: xOf(i), text: props.labels[i] })
    return out
})
const onMove = (e) => {
    if (n.value < 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const stepX = n.value <= 1 ? innerW.value : innerW.value / (n.value - 1)
    hover.value = Math.min(n.value - 1, Math.max(0, Math.round((x - pad.l) / stepX)))
}
const tipStyle = computed(() => {
    const x = xOf(hover.value)
    return { left: (x > w.value * 0.6 ? x - 176 : x + 12) + 'px', top: '6px' }
})

const fmtNum = (v) => {
    const x = Number(v) || 0
    const s = Number.isInteger(x) ? String(x) : x.toFixed(1)
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
const total = computed(() => props.items.reduce((a, it) => a + (Number(it.value) || 0), 0))
const maxItem = computed(() => props.items.reduce((a, it) => Math.max(a, Number(it.value) || 0), 0))
const barPct = (v) => (maxItem.value ? Math.max(1, (Number(v) || 0) / maxItem.value * 100) : 0)
</script>

<style lang="scss" scoped>
.mc {
    width: 100%;
    .mc-hd { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;
        .mc-t { font-size: 13px; font-weight: 600; color: #303133; }
        .mc-s { font-size: 12px; color: #909399; }
    }
    .mc-plot { position: relative; }
    .mc-svg { display: block; }
    .mc-grid { stroke: #ebeef5; stroke-width: 1; }
    .mc-cross { stroke: #c0c4cc; stroke-width: 1; stroke-dasharray: 3 3; }
    .mc-tick { position: absolute; color: #909399; font-size: 11px; line-height: 14px; pointer-events: none; white-space: nowrap; }
    .mc-ytick { left: 0; text-align: right; }
    .mc-xtick { transform: translateX(-50%); }
    .mc-tip { position: absolute; width: 164px; background: #fff; border: 1px solid #ebeef5; border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, .08); padding: 6px 8px; font-size: 12px; pointer-events: none; z-index: 5;
        .mc-tip-l { color: #909399; margin-bottom: 2px; }
        .mc-tip-r { display: flex; align-items: center; gap: 6px; color: #606266; line-height: 1.6;
            i { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }
            b { margin-left: auto; color: #303133; font-variant-numeric: tabular-nums; }
        }
    }
    .mc-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 4px; font-size: 12px; color: #606266;
        span { display: inline-flex; align-items: center; gap: 5px; }
        i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    }
    .mc-bars { display: flex; flex-direction: column; gap: 6px; }
    .mc-bar { display: flex; align-items: center; gap: 8px; font-size: 12px;
        .mc-bl { flex: 0 0 76px; color: #606266; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
        .mc-bt { flex: 1; height: 12px; background: #f5f7fa; border-radius: 4px; overflow: hidden; }
        .mc-bf { height: 100%; border-radius: 4px; transition: width .3s; }
        .mc-bv { flex: 0 0 110px; color: #303133; font-variant-numeric: tabular-nums; white-space: nowrap; i { font-style: normal; color: #909399; } }
    }
    .mc-empty { font-size: 12px; color: #c0c4cc; padding: 12px 0; text-align: center; }
}
</style>
