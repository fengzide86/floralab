'use strict';

const STAGES = {
  exploring: '探索中',
  preparing: '准备材料',
  making: '制作中',
  finished: '已完成'
};
function facts(plan) {
  return {
    recipe: (plan.recipe || [])
      .filter((r) => r.quantity > 0)
      .map((r) => [r.key, r.name, r.variant, r.quantity, r.unit]),
    vessel: plan.vessel,
    mechanics: plan.mechanics,
    dimensions: plan.dimensions,
    nodes: (plan.blueprint?.nodes || []).map((n) => [
      n.id,
      n.material_id,
      n.name,
      n.color,
      n.x,
      n.y,
      n.z,
      n.length_cm,
      n.yaw_deg,
      n.pitch_deg,
      n.stage
    ]),
    anchors: plan.blueprint?.mechanics
  };
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])])
    );
  return value;
}
function signature(plan) {
  // Version marker, not a security hash. Identical in Node and browser builds.
  const text = JSON.stringify(stable(facts(plan)));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return 'facts1-' + (hash >>> 0).toString(16) + '-' + text.length;
}
function stage(plan) {
  return STAGES[plan.workflow?.stage] ? plan.workflow.stage : 'exploring';
}
function change(raw, patch) {
  const plan = JSON.parse(JSON.stringify(raw));
  if (patch.title !== undefined) {
    const title = String(patch.title).trim();
    if (!title || title.length > 100)
      throw new Error('作品名称请填写 1–100 个字');
    plan.title = title;
  }
  if (patch.stage !== undefined) {
    if (!STAGES[patch.stage]) throw new Error('未知制作阶段');
    plan.workflow = {
      ...plan.workflow,
      stage: patch.stage,
      updatedAt: new Date().toISOString()
    };
  }
  return plan;
}
module.exports = { facts, signature, stage, STAGES, change };
