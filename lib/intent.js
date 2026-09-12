'use strict';

// Bounded, explainable parsing. Unrecognized prose remains visible to the creator.
const COLORS = [
  ['奶油', '奶油色'],
  ['香槟', '香槟色'],
  ['紫', '紫色'],
  ['白', '白色'],
  ['粉', '粉色'],
  ['红', '红色'],
  ['蓝', '蓝色'],
  ['黄', '黄色'],
  ['橙', '橙色'],
  ['绿', '绿色'],
  ['黑', '黑色']
];
const NEGATIVE = /(?:不要|不用|不放|不加|不使用|不想要|避免|排除|别用|拒绝)/;
const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namesOf = (item) =>
  [item.name, ...(item.aliases || [])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
function clauses(text) {
  return String(text || '')
    .split(/[，。；,;\n]|(?:但是|但要|但是要)/)
    .filter(Boolean);
}
function mentioned(text, item) {
  return namesOf(item).some((name) => text.includes(name));
}
function positiveClauses(text) {
  return clauses(text)
    .map((part) => part.split(NEGATIVE)[0])
    .filter(Boolean);
}
function negativeClauses(text) {
  return clauses(text)
    .filter((part) => NEGATIVE.test(part))
    .map((part) => part.slice(part.search(NEGATIVE)));
}
function quantity(text, item) {
  for (const name of namesOf(item)) {
    const n = escape(name),
      before = new RegExp(
        `(\\d{1,3})\\s*(?:枝|支|朵|个|颗|包|张|根|条)?\\s*(?:白色?|粉色?|紫色?|红色?|黄色?|蓝色?|绿色?|奶油色?)?${n}`
      ),
      after = new RegExp(
        `${n}\\s*[×x*]?\\s*(\\d{1,3})(?:枝|支|朵|个|颗|包|张|根|条)?`
      );
    const match = text.match(before) || text.match(after);
    if (match) return Number(match[1]);
  }
  return null;
}
function materialColor(text, item) {
  for (const name of namesOf(item))
    for (const [key] of COLORS)
      if (new RegExp(`${escape(key)}色?\\s*${escape(name)}`).test(text))
        return key;
  return '';
}
function inspect(catalog, input = {}) {
  const idea = String(input.idea || input.prompt || '').trim(),
    positive = positiveClauses(idea).join(' ').replace(/留白/g, '留空'),
    negative = [...negativeClauses(idea), String(input.avoid || '')].join(' '),
    existing = String(input.existing || ''),
    preferred = String(input.preferred || '');
  const mentionedColors = COLORS.filter(
    ([key]) =>
      new RegExp(
        `${escape(key)}(?:色|绿|白|紫|粉|红|黄|蓝|玫瑰|绣球|洋桔梗|花束|花艺|桌花|瓶插|的|[，,。]|$)`
      ).test(positive) || positive === key
  ).map(([, label]) => label);
  const excludedColors = COLORS.filter(
    ([key]) =>
      new RegExp(`${escape(key)}色`).test(negative) || negative.trim() === key
  ).map(([, label]) => label);
  const selected = (input.colors || []).map((x) =>
    x.endsWith('色') ? x : x + '色'
  );
  const colors = [
    ...new Set(
      (mentionedColors.length ? mentionedColors : selected).filter(
        (c) => !excludedColors.includes(c)
      )
    )
  ].slice(0, 4);
  const excludes = [],
    required = [],
    conflicts = [];
  for (const item of [...catalog.flowers, ...catalog.creative]) {
    const isExcluded = mentioned(negative, item);
    if (isExcluded) excludes.push(item.name);
    const owned = mentioned(existing, item),
      wanted = mentioned(positive + ' ' + preferred, item);
    if (isExcluded && (owned || wanted))
      conflicts.push(
        `${item.name}同时出现在“不使用”和“已有 / 指定材料”中，请保留一项。`
      );
    if (!isExcluded && (owned || wanted)) {
      const text = owned ? existing : positive + ' ' + preferred;
      const color = materialColor(text, item),
        qty = quantity(text, item);
      if (qty !== null && (qty < 1 || qty > 80))
        conflicts.push(
          `${item.name}的数量应在 1–80 之间；较大作品请拆成独立部分。`
        );
      if (color && item.colors && !item.colors.includes(color))
        conflicts.push(
          `材料库尚未确认${color}${item.name}，请调整颜色或先在创作空间核实。`
        );
      if (color && excludedColors.includes(color + '色'))
        conflicts.push(`${color}${item.name}与排除颜色冲突。`);
      required.push({
        id: item.id,
        name: item.name,
        quantity: qty,
        color,
        owned
      });
    }
  }
  const type =
    ['创意装置', '创意花束', '花束', '瓶插', '桌花', '花篮', '礼盒'].find((x) =>
      positive.includes(x)
    ) ||
    input.type ||
    '花束';
  return {
    version: 1,
    original: idea,
    colors,
    excludedColors,
    excludes,
    required,
    type,
    conflicts,
    unparsed: idea,
    note: '规则识别的起点；未识别的气质、数量和结构请核对，复杂想法可带到创作空间继续。'
  };
}
function normalize(catalog, input) {
  const intent = inspect(catalog, input);
  if (intent.conflicts.length) {
    const error = new Error(intent.conflicts.join('；'));
    error.code = 'intent_conflict';
    throw error;
  }
  return {
    ...input,
    prompt: input.idea || input.prompt || '',
    type: intent.type,
    colors: intent.colors.length ? intent.colors : undefined,
    avoid: [input.avoid, ...intent.excludes, ...intent.excludedColors]
      .filter(Boolean)
      .join('、'),
    _intent: intent
  };
}
module.exports = {
  inspect,
  normalize,
  negativeClauses,
  mentioned,
  quantity,
  materialColor
};
