import assert from 'node:assert/strict';
import { computeGuidance, dateKey, addDays } from '../js/data.js';

const user = {
  nickname: '测试', sex: 'male', ageBand: '26-35', height: 172, weight: 75,
  goal: 'health', freq: 4, level: 'regular'
};
const weights = [
  { date: dateKey(addDays(new Date(), -20)), kg: 76 },
  { date: dateKey(new Date()), kg: 74.5 }
];

const empty = computeGuidance(user, [], weights);
assert.equal(empty.mode, 'start');
assert.equal(empty.currentWeight, 74.5, 'guidance should use the latest weight log');
assert.equal(empty.calorie.protein, Math.round(74.5 * 1.3));

const today = dateKey(new Date());
const todayStrength = {
  id: 'today-strength', type: 'strength', date: today, duration: 30, rpe: 8,
  strength: [{ name: '卧推', part: 'chest', sets: 4, reps: 8, weight: 60 }]
};
const after = computeGuidance(user, [todayStrength], weights);
assert.equal(after.mode, 'recover');
assert.ok(after.session.title.includes('恢复'));
assert.ok(after.insights.some((x) => x.includes('今天已完成')));
assert.ok(after.insights.some((x) => x.includes('胸')));

const yesterday = dateKey(addDays(new Date(), -1));
const upper = {
  id: 'upper', type: 'strength', date: yesterday, duration: 40, rpe: 7,
  strength: [{ name: '卧推', part: 'chest', sets: 4, reps: 8, weight: 60 }]
};
const recent = computeGuidance(user, [upper], weights);
assert.ok(recent.insights.some((x) => x.includes('胸')), 'recent body part should be visible');

console.log('Guidance tests passed:', {
  mode: after.mode,
  title: after.session.title,
  weight: after.currentWeight,
  insights: after.insights.length
});
