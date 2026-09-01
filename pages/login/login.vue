<template>
    <view class="login-page">
        <el-card class="login-card" shadow="hover">
            <template #header>
                <div class="login-title">采黎后台 · 登录</div>
            </template>
            <el-form :model="form" label-position="top" @submit.prevent="submit">
                <el-form-item label="账号">
                    <el-input v-model="form.account" placeholder="账号" autocomplete="username" clearable @keyup.enter="submit" />
                </el-form-item>
                <el-form-item label="密码">
                    <el-input v-model="form.password" type="password" placeholder="密码" autocomplete="current-password" show-password @keyup.enter="submit" />
                </el-form-item>
                <el-button type="primary" class="login-btn" :loading="loading" @click="submit">登录</el-button>
            </el-form>
        </el-card>
    </view>
</template>

<script setup>
/**
 * 后台登录页(09-01):账号密码交给 pay-manual.login 云端校验,通过后存 token 进首页。
 * 后台其他页面的数据仍走 schema 全开的客户端 JQL,这层登录只管「谁在操作」与手工到账的鉴权。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { setSession, applyRole, authApi } from '@/utils/auth'

const form = ref({ account: '', password: '' })
const loading = ref(false)

const submit = async () => {
    if (loading.value) return
    const account = String(form.value.account || '').trim()
    const password = String(form.value.password || '')
    if (!account || !password) return ElMessage.warning('请输入账号和密码')

    loading.value = true
    const res = await authApi().login({ account, password }).catch(e => ({ errMsg: e.message || '登录失败' }))
    loading.value = false

    if (!res || res.errMsg) return ElMessage.error((res && res.errMsg) || '登录失败')

    setSession({ token: res.data.token, name: res.data.name, expireAt: res.data.expireAt })
    applyRole(res.data.name)
    uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #E8F4FC;
}
.login-card {
    width: 360px;
}
.login-title {
    font-size: 18px;
    font-weight: 600;
    text-align: center;
}
.login-btn {
    width: 100%;
    margin-top: 8px;
}
</style>
