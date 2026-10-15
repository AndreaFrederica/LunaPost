import { createRouter, createWebHistory } from 'vue-router'
import IndexPage from '../pages/IndexPage.vue'
import ProjectPage from '../pages/ProjectPage.vue'
import AuthPage from '../pages/AuthPage.vue'
import SetupPage from '../pages/SetupPage.vue'
import AdminPage from '../pages/AdminPage.vue'
import AccountPage from '../pages/AccountPage.vue'
import ProjectEditorPage from '../pages/ProjectEditorPage.vue'
import UserProfilePage from '../pages/UserProfilePage.vue'
import OrganizationPage from '../pages/OrganizationPage.vue'
import ApiDocsPage from '../pages/ApiDocsPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: IndexPage },
    { path: '/projects/:slug/:tab?', component: ProjectPage },
    { path: '/users/:id', component: UserProfilePage },
    { path: '/organizations/:slug', component: OrganizationPage },
    { path: '/api', component: ApiDocsPage },
    { path: '/auth', component: AuthPage },
    { path: '/setup', component: SetupPage },
    { path: '/admin', component: AdminPage },
    { path: '/account', component: AccountPage },
    { path: '/admin/projects/new', component: ProjectEditorPage },
    { path: '/admin/projects/:slug/edit', component: ProjectEditorPage },
    { path: '/:pathMatch(.*)*', component: NotFoundPage },
  ],
})
