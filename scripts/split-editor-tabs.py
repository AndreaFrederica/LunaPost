from pathlib import Path
p=Path('apps/web/src/pages/ProjectEditorPage.vue')
s=p.read_text()
ls=s.index('<div class="col-12 license-editor">')
le=s.index('<q-input v-model="form.repositoryUrl"',ls)
license=s[ls:le]
gs=s.index('<div class="col-12 gallery-editor">')
ge=s.index('<q-input v-model="form.description"',gs)
gallery=s[gs:ge]
s=s[:ls]+s[le:]
# after removal gallery indices changed, find again
gs=s.index('<div class="col-12 gallery-editor">')
ge=s.index('<q-input v-model="form.description"',gs)
gallery=s[gs:ge]
s=s[:gs]+s[ge:]
# Add top tabs
s=s.replace('<q-tab name="basic" icon="info" label="基本信息" />', '<q-tab name="basic" icon="info" label="基本信息" /><q-tab name="gallery" icon="photo_library" label="画廊" /><q-tab name="licenses" icon="gavel" label="许可证" />')
# Insert panels just after basic panel
needle='          </q-tab-panel>\n\n          <q-tab-panel name="content">'
insert=f'''          </q-tab-panel>\n\n          <q-tab-panel name="gallery">\n            <div class="text-h6 q-mb-md">项目画廊</div>\n            {gallery}\n          </q-tab-panel>\n\n          <q-tab-panel name="licenses">\n            <div class="text-h6 q-mb-md">许可证文件</div>\n            {license}\n          </q-tab-panel>\n\n          <q-tab-panel name="content">'''
if needle not in s: raise SystemExit('needle missing')
s=s.replace(needle,insert,1)
p.write_text(s)
