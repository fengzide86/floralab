'use strict';

// Recipe owns quantities, owned stock and purchase totals. No DOM or persistence.
function buildRecipe(plan) {
  const rows = [];
  const previous=new Map((plan.recipe||[]).map(r=>[r.key,r]));
  for (const f of plan.flowers || [])
    rows.push({
      key: `flower:${f.id}`,
      kind: 'flower',
      id: f.id,
      name: f.name,
      variant: f.color || '',
      role: f.role || '',
      quantity: Number(f.quantity || 0),
      unit: f.unit || '枝',
      owned: Number(f.existing_quantity || 0),
      unit_price: Number(f.unit_price || 0),
      source: 'catalog'
    });
  for (const c of plan.creative || [])
    rows.push({
      key: `creative:${c.id}`,
      kind: 'creative',
      id: c.id,
      name: c.name,
      variant: c.category || '',
      role: '创意物件',
      quantity: Number(c.quantity || 0),
      unit: c.unit || '个',
      owned: Number(c.existing_quantity || 0),
      unit_price: Number(c.unit_price || 0),
      source: 'catalog'
    });
  for (const s of plan.supplies || [])
    rows.push({
      key: `supply:${s.name}`,
      kind: 'supply',
      id: s.name,
      name: s.name,
      variant: s.color || '',
      role: s.purpose || '辅材',
      quantity: Number(s.quantity || 0),
      unit: s.unit || '份',
      owned: Number(s.existing_quantity || 0),
      unit_price: Number(s.unit_price || 0),
      source: 'catalog'
    });
  if (Number(plan.cost?.vessel || 0) > 0)
    rows.push({
      key: 'vessel:main',
      kind: 'vessel',
      id: 'main',
      name: plan.vessel?.name || '花器',
      variant: plan.vessel?.color || '',
      role: '花器',
      quantity: 1,
      unit: '个',
      owned: 0,
      unit_price: Number(plan.cost.vessel || 0),
      source: 'catalog'
    });
  for (const r of rows) {
    const old=previous.get(r.key);
    if(old?.unit_price===null)r.unit_price=null;
    if(old?.price_source)r.price_source=old.price_source;
    r.quantity = Math.max(0, Number(r.quantity || 0));
    r.owned = Math.min(r.quantity, Math.max(0, Number(r.owned || 0)));
    r.unit_price = r.unit_price===null?null:Math.max(0, Number(r.unit_price || 0));
    r.to_buy = Math.max(0, r.quantity - r.owned);
    r.subtotal = Number((r.to_buy * r.unit_price).toFixed(2));
  }
  return rows;
}
function totalsFromRecipe(recipe) {
  const groups = { flower: 0, creative: 0, supply: 0, vessel: 0 };
  for (const r of recipe || [])
    groups[r.kind] = (groups[r.kind] || 0) + Number(r.subtotal || 0);
  return {
    flowers: groups.flower || 0,
    creative: groups.creative || 0,
    supplies: groups.supply || 0,
    vessel: groups.vessel || 0,
    total: Object.values(groups).reduce((a, b) => a + b, 0)
  };
}
function budgetCheck(plan) {
  const checks = (plan.checks || []).filter((x) => x.id !== 'budget');
  const budget = Number(plan.request?.budget || plan.cost?.budget || 0),
    total = Number(plan.cost?.total || 0),
    priority = plan.request?.budgetPriority || 'balance';
  if (budget > 0 && total > budget && priority !== 'effect')
    checks.push({
      id: 'budget',
      label: '预算',
      status: 'block',
      detail: `当前需购约 ¥${Math.round(total)}，高于预算 ¥${Math.round(budget)}。减少数量、补充已有材料、调整单价或提高预算。`
    });
  else if (budget > 0 && total > budget)
    checks.push({
      id: 'budget',
      label: '预算',
      status: 'warn',
      detail: `当前选择效果优先，需购约 ¥${Math.round(total)}，高于参考预算 ¥${Math.round(budget)}。`
    });
  else if (budget > 0)
    checks.push({
      id: 'budget',
      label: '预算',
      status: 'pass',
      detail: `当前需购约 ¥${Math.round(total)}，未超过预算 ¥${Math.round(budget)}。`
    });
  plan.checks = checks;
}
function syncPlanFromRecipe(plan) {
  const map = new Map((plan.recipe || []).map((r) => [r.key, r]));
  for (const f of plan.flowers || []) {
    const r = map.get(`flower:${f.id}`);
    if (r) {
      f.quantity = r.quantity;
      f.existing_quantity = r.owned;
      f.unit_price = r.unit_price;
      f.subtotal = r.subtotal;
    }
  }
  for (const c of plan.creative || []) {
    const r = map.get(`creative:${c.id}`);
    if (r) {
      c.quantity = r.quantity;
      c.existing_quantity = r.owned;
      c.unit_price = r.unit_price;
      c.price = r.subtotal;
    }
  }
  for (const s of plan.supplies || []) {
    const r = map.get(`supply:${s.name}`);
    if (r) {
      s.quantity = r.quantity;
      s.existing_quantity = r.owned;
      s.unit_price = r.unit_price;
      s.subtotal = r.subtotal;
    }
  }
  const t = totalsFromRecipe(plan.recipe || []);
  plan.cost = {
    ...(plan.cost || {}),
    ...t,
    range: [Math.round(t.total * 0.9), Math.round(t.total * 1.15)]
  };
  const unknown=(plan.recipe||[]).filter(r=>r.to_buy>0&&r.unit_price===null).length;
  if(unknown)plan.cost.unknown_prices=unknown;else delete plan.cost.unknown_prices;
  budgetCheck(plan);
  return plan;
}

module.exports = {
  buildRecipe,
  totalsFromRecipe,
  budgetCheck,
  syncPlanFromRecipe
};
