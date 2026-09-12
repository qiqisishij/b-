import fs from 'node:fs';

const js = fs.readFileSync(new URL('../src/b站喵喵乐-v5.js', import.meta.url), 'utf8');
const out = {
  type: 'script',
  enabled: true,
  name: 'b站喵喵乐 v5',
  id: 'b2a0ef67-30fa-4ca1-9ab4-498853f7b8a5',
  content: js,
  info: 'b站喵喵乐 v5：解析 / 收藏 / 播放 / 设置 / 我的；移除账号登录与UP功能；本地收藏与历史；B站合集公开目录解析；小窗续播与沉浸模式。',
  button: {
    enabled: true,
    buttons: [{ name: '打开b站喵喵乐', visible: true }]
  },
  data: {},
  export_with: { data: true, button: true }
};
fs.writeFileSync(new URL('../build/b站喵喵乐-v5.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('built');
