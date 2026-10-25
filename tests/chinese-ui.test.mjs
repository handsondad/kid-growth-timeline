import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { parse, compileTemplate } from 'vue/compiler-sfc'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const read = (file) => readFileSync(path.join(root, file), 'utf8')

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.(vue|ts)$/.test(file)
        ? [file]
        : []
  })
}

function loadTypescript(file, globals = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  new Function(
    'require',
    'module',
    'exports',
    ...Object.keys(globals),
    compiled,
  )(
    (id) =>
      id === './contants'
        ? loadTypescript('server/services/settings/contants.ts')
        : require(id),
    module,
    module.exports,
    ...Object.values(globals),
  )
  return module.exports
}

test('Chinese-only UI has no language runtime, language menu or duplicate docs tree', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.dependencies['@nuxtjs/i18n'], undefined)
  assert.equal(existsSync(path.join(root, 'i18n')), false)
  assert.equal(existsSync(path.join(root, 'docs', 'zh')), false)
  assert.match(read('app/app.vue'), /lang: 'zh-CN'/)
  assert.match(read('app/app.vue'), /:locale="zh_cn"/)
  assert.match(read('nuxt.config.ts'), /defaultLocale: 'zh-cn'/)
  for (const file of sourceFiles(path.join(root, 'app'))) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /\$t\(|\$i18n|useI18n|useLocalePreference|labelI18n/,
      file,
    )
  }
})

test('all Vue templates and scripts remain syntactically valid after Chinese text inlining', () => {
  for (const file of sourceFiles(path.join(root, 'app'))) {
    const source = readFileSync(file, 'utf8')
    const scripts = []
    if (file.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: file })
      assert.deepEqual(errors, [], file)
      if (descriptor.template) {
        const result = compileTemplate({
          source: descriptor.template.content,
          filename: file,
          id: 'chinese-ui',
          compilerOptions: { expressionPlugins: ['typescript'] },
        })
        assert.deepEqual(result.errors, [], file)
      }
      if (descriptor.script) scripts.push(descriptor.script.content)
      if (descriptor.scriptSetup) scripts.push(descriptor.scriptSetup.content)
    } else {
      scripts.push(source)
    }
    for (const script of scripts) {
      const result = ts.transpileModule(script, {
        fileName: `${file}.ts`,
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      })
      assert.deepEqual(
        result.diagnostics?.filter(
          (item) => item.category === ts.DiagnosticCategory.Error,
        ),
        [],
        file,
      )
    }
  }
})

test('application fonts use system stacks without automatic online font providers', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.dependencies['@nuxt/fonts'], undefined)
  const config = read('nuxt.config.ts')
  assert.doesNotMatch(config, /['"]@nuxt\/fonts['"]/)
  assert.match(config, /ui:\s*\{\s*fonts:\s*false/)
  const css = read('app/assets/css/tailwind.css')
  assert.match(
    css,
    /--font-sans:[^;]*Microsoft YaHei[^;]*PingFang SC[^;]*system-ui/s,
  )
  assert.match(css, /--font-serif:[^;]*SimSun/s)
  for (const file of sourceFiles(path.join(root, 'app'))) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /Rubik|Noto Sans SC|Noto Serif SC|Pacifico|fonts\.(?:googleapis|gstatic|google)\.com/,
      file,
    )
  }
})

test('server-rendered sharing images retain Chinese glyphs with a bundled offline font', async () => {
  const css = read('app/assets/css/tailwind.css')
  assert.match(
    css,
    /@font-face\s*\{[^}]*font-family: 'Timeline Chinese';[^}]*url\('\/fonts\/NotoSansSC\.woff2'\)/s,
  )
  assert.match(
    read('app/components/OgImage/Photo.takumi.vue'),
    /font-family: 'Timeline Chinese', sans-serif/,
  )
  assert.match(read('public/fonts/LICENSE.txt'), /SIL OPEN FONT LICENSE/)
  const data = readFileSync(path.join(root, 'public/fonts/NotoSansSC.woff2'))
  assert.equal(data.subarray(0, 4).toString(), 'wOF2')

  const { Renderer } = await import('@takumi-rs/core')
  const { default: sharp } = await import('sharp')
  const renderer = new Renderer()
  await renderer.registerFont({ name: 'Timeline Chinese', data })
  for (const fontWeight of [400, 700]) {
    const png = await renderer.render(
      {
        type: 'text',
        text: '中文成长时光轴',
        style: {
          width: 400,
          height: 80,
          fontFamily: 'Timeline Chinese',
          fontSize: 40,
          fontWeight,
          color: '#000000',
          backgroundColor: '#ffffff',
        },
      },
      { width: 400, height: 80, format: 'png' },
    )
    const pixels = await sharp(png).ensureAlpha().raw().toBuffer()
    let inkPixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        pixels[i + 3] > 0 &&
        pixels[i] < 100 &&
        pixels[i + 1] < 100 &&
        pixels[i + 2] < 100
      ) {
        inkPixels++
      }
    }
    assert.ok(inkPixels > 1000, `Chinese text is blank at weight ${fontWeight}`)
  }
})

test('Chinese EXIF values retain unknown values and valid zero values', () => {
  const { formatExifValue } = loadTypescript('app/utils/format-exif.ts')
  assert.equal(formatExifValue('whiteBalance', 'Auto'), '自动')
  assert.equal(formatExifValue('colorSpace', 'sRGB'), 'sRGB')
  assert.equal(
    formatExifValue('flash', 'Unknown vendor value'),
    'Unknown vendor value',
  )
  assert.equal(formatExifValue('exposureMode', 0), '0')
  assert.equal(formatExifValue('flash', undefined), '')
})

test('Chinese photo counts retain their date ranges and year labels', () => {
  assert.match(
    read('app/components/masonry/item/Header.vue'),
    /\$\{dateRangeText\}, 共 \$\{stats\?\.total\} 张照片/,
  )
  const index = read('app/components/masonry/TimeIndex.vue')
  assert.match(index, /\$\{dateRange\}, 共 \$\{props\.photos\.length\} 张照片/)
  assert.match(index, /\$\{entry\.year\}, 共 \$\{entry\.count\} 张照片/)
})

test('existing settings display current Chinese labels without rewriting stored values', async () => {
  const row = Object.freeze({
    namespace: 'app',
    key: 'title',
    type: 'string',
    value: '我的家庭影像',
    defaultValue: 'Kid Growth Timeline',
    label: 'settings.app.title.label',
    description: 'settings.app.title.description',
    enum: null,
  })
  const { settingsManager } = loadTypescript(
    'server/services/settings/settingsManager.ts',
    {
      logger: { dynamic: () => ({}) },
      useDB: () => ({
        select: () => ({ from: () => ({ all: () => [row] }) }),
      }),
      tables: { settings: {} },
    },
  )
  const schema = await settingsManager.getSchema()
  const { DEFAULT_SETTINGS } = loadTypescript(
    'server/services/settings/contants.ts',
  )
  const current = DEFAULT_SETTINGS.find(
    (item) => item.namespace === 'app' && item.key === 'title',
  )
  assert.equal(schema[0].label, current.label)
  assert.equal(schema[0].description, current.description)
  assert.equal(schema[0].value, row.value)
  assert.equal(row.label, 'settings.app.title.label')
  assert.equal(
    DEFAULT_SETTINGS.some(
      (item) => item.namespace === 'location' && item.key === 'language',
    ),
    false,
  )
})
