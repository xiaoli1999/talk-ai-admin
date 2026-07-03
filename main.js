import App from './App'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
// 引入element plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// element-plus 内置组件文案汉化（日期选择器面板、分页、确认框等）
import zhCn from 'element-plus/es/locale/lang/zh-cn'

export function createApp() {
  const app = createSSRApp(App)
  app.use(ElementPlus, { locale: zhCn, zIndex: 1000 })
  // app.use(ElementPlus, { size: 'small', zIndex: 1000 })
  return {
    app
  }
}
// #endif
