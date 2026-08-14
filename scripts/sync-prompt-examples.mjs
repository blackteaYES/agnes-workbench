import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'config', 'prompt-examples.json');
const outputPath = path.join(root, 'config', 'prompt-examples.generated.js');
const checkOnly = process.argv.includes('--check');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateString(value, label) {
  assert(typeof value === 'string' && value.trim(), `${label} 必须是非空字符串。`);
}

async function validateConfig(config) {
  assert(config && typeof config === 'object' && !Array.isArray(config), '案例配置必须是 JSON 对象。');
  assert(config.version === 1, '案例配置 version 必须为 1。');
  const section = config.textToImage;
  assert(section && typeof section === 'object' && !Array.isArray(section), '缺少 textToImage 配置。');
  validateString(section.title, 'textToImage.title');
  validateString(section.description, 'textToImage.description');
  assert(Array.isArray(section.examples) && section.examples.length > 0, 'textToImage.examples 至少包含一个案例。');

  const ids = new Set();
  for (const [index, example] of section.examples.entries()) {
    const label = `textToImage.examples[${index}]`;
    assert(example && typeof example === 'object' && !Array.isArray(example), `${label} 必须是对象。`);
    for (const key of ['id', 'title', 'image', 'alt', 'prompt']) validateString(example[key], `${label}.${key}`);
    assert(!ids.has(example.id), `案例 ID 重复：${example.id}`);
    ids.add(example.id);

    if (/^https:\/\//i.test(example.image)) continue;
    assert(!/^[a-z][a-z\d+.-]*:/i.test(example.image), `${label}.image 只允许相对路径或 HTTPS URL。`);
    const imagePath = path.resolve(root, example.image.replaceAll('/', path.sep));
    const relative = path.relative(root, imagePath);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `${label}.image 必须位于项目目录内。`);
    try {
      await access(imagePath);
    } catch (error) {
      throw new Error(`${label}.image 不存在：${example.image}`);
    }
  }
}

const source = await readFile(sourcePath, 'utf8');
const config = JSON.parse(source);
await validateConfig(config);

const normalized = `${JSON.stringify(config, null, 2)}\n`;
const hash = createHash('sha256').update(normalized).digest('hex');
const generated = [
  "'use strict';",
  '',
  '// 此文件由 scripts/sync-prompt-examples.mjs 生成，请勿手动修改。',
  `// source-sha256: ${hash}`,
  `window.AG_PROMPT_EXAMPLES = ${normalized.trimEnd()};`,
  ''
].join('\n');

if (checkOnly) {
  let current = '';
  try {
    current = await readFile(outputPath, 'utf8');
  } catch (error) {
    throw new Error('缺少 config/prompt-examples.generated.js，请先运行同步命令。');
  }
  assert(current.replace(/\r\n/g, '\n') === generated, '案例生成文件已过期，请运行 node scripts/sync-prompt-examples.mjs。');
  console.log('案例配置与生成文件一致。');
} else {
  await writeFile(outputPath, generated, 'utf8');
  console.log(`已生成 ${path.relative(root, outputPath)}。`);
}
