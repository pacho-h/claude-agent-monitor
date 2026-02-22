// Agent visual definitions — 28 types
// Each: { emoji, label, zone, color, size }

const AGENT_DEFS = {
  // ── Planning Zone ──────────────────────────────
  'team-lead':              { emoji: '👑', label: 'Team Lead',           zone: 'planning', color: '#ffd700', size: 1.3 },
  'architect':              { emoji: '🏗️', label: 'Architect',           zone: 'planning', color: '#7c83ff', size: 1.1 },
  'planner':                { emoji: '📋', label: 'Planner',             zone: 'planning', color: '#64b5f6', size: 1.0 },
  'analyst':                { emoji: '🔍', label: 'Analyst',             zone: 'planning', color: '#4dd0e1', size: 1.0 },
  'critic':                 { emoji: '🎯', label: 'Critic',              zone: 'planning', color: '#ef5350', size: 1.0 },
  'product-manager':        { emoji: '📊', label: 'PM',                  zone: 'planning', color: '#ab47bc', size: 1.0 },
  'ux-researcher':          { emoji: '👤', label: 'UX Research',         zone: 'planning', color: '#ec407a', size: 0.95 },
  'information-architect':  { emoji: '🗺️', label: 'Info Arch',           zone: 'planning', color: '#5c6bc0', size: 0.95 },
  'product-analyst':        { emoji: '📈', label: 'Product Analyst',     zone: 'planning', color: '#8d6e63', size: 0.95 },

  // ── Coding Zone ────────────────────────────────
  'executor':               { emoji: '⚡', label: 'Executor',            zone: 'coding',   color: '#ffb300', size: 1.1 },
  'deep-executor':          { emoji: '🔥', label: 'Deep Executor',      zone: 'coding',   color: '#ff6d00', size: 1.15 },
  'designer':               { emoji: '🖌️', label: 'Designer',            zone: 'coding',   color: '#f06292', size: 1.0 },
  'writer':                 { emoji: '✍️', label: 'Writer',              zone: 'coding',   color: '#81c784', size: 0.95 },
  'build-fixer':            { emoji: '🔧', label: 'Build Fixer',        zone: 'coding',   color: '#a1887f', size: 1.0 },
  'debugger':               { emoji: '🐛', label: 'Debugger',           zone: 'coding',   color: '#e57373', size: 1.0 },
  'explore':                { emoji: '🔭', label: 'Explorer',           zone: 'coding',   color: '#4fc3f7', size: 0.95 },
  'scientist':              { emoji: '🔬', label: 'Scientist',          zone: 'coding',   color: '#aed581', size: 0.95 },
  'dependency-expert':      { emoji: '📦', label: 'Dep Expert',         zone: 'coding',   color: '#dce775', size: 0.95 },
  'git-master':             { emoji: '🌿', label: 'Git Master',         zone: 'coding',   color: '#66bb6a', size: 0.95 },

  // ── Review Zone ────────────────────────────────
  'verifier':               { emoji: '✅', label: 'Verifier',            zone: 'review',   color: '#66bb6a', size: 1.1 },
  'code-reviewer':          { emoji: '📝', label: 'Code Review',        zone: 'review',   color: '#7986cb', size: 1.0 },
  'style-reviewer':         { emoji: '🎨', label: 'Style Review',       zone: 'review',   color: '#ba68c8', size: 0.95 },
  'quality-reviewer':       { emoji: '⚖️', label: 'Quality Review',     zone: 'review',   color: '#4db6ac', size: 1.0 },
  'api-reviewer':           { emoji: '🔌', label: 'API Review',         zone: 'review',   color: '#ff8a65', size: 0.95 },
  'security-reviewer':      { emoji: '🛡️', label: 'Security Review',    zone: 'review',   color: '#e53935', size: 1.05 },
  'performance-reviewer':   { emoji: '⏱️', label: 'Perf Review',        zone: 'review',   color: '#ffa726', size: 0.95 },
  'qa-tester':              { emoji: '🧪', label: 'QA Tester',          zone: 'review',   color: '#26c6da', size: 1.0 },
  'test-engineer':          { emoji: '🧬', label: 'Test Engineer',      zone: 'review',   color: '#9ccc65', size: 1.0 },
  'document-specialist':    { emoji: '📚', label: 'Doc Specialist',     zone: 'review',   color: '#78909c', size: 0.95 },
  'quality-strategist':     { emoji: '📐', label: 'Quality Strategy',   zone: 'review',   color: '#26a69a', size: 0.95 },
};

// Fallback for unknown agent types
const DEFAULT_DEF = { emoji: '🤖', label: 'Agent', zone: 'coding', color: '#90a4ae', size: 1.0 };

export function getAgentDef(agentType) {
  if (!agentType) return { ...DEFAULT_DEF };
  // Normalize: strip "oh-my-claudecode:" prefix, lowercase
  const key = agentType.replace(/^oh-my-claudecode:/, '').toLowerCase();
  return AGENT_DEFS[key] ? { ...AGENT_DEFS[key] } : { ...DEFAULT_DEF, label: key };
}

export function getAllDefs() {
  return { ...AGENT_DEFS };
}

// Zone layout definitions (proportional 0-1 coordinates)
export const ZONES = {
  planning: { x: 0.02, y: 0.03, w: 0.46, h: 0.52, color: '#0d1b2a', border: '#1b3a5c', label: 'PLANNING ZONE' },
  coding:   { x: 0.52, y: 0.03, w: 0.46, h: 0.52, color: '#0a1f12', border: '#1a4a2e', label: 'CODING ZONE' },
  review:   { x: 0.02, y: 0.59, w: 0.96, h: 0.38, color: '#1a0d24', border: '#3a1d5c', label: 'REVIEW ZONE' },
};

// Animation states
export const ANIM_STATES = {
  idle:    { wobbleSpeed: 0.5,  wobbleAmp: 2,  glowRadius: 0,  glowAlpha: 0 },
  working: { wobbleSpeed: 3.0,  wobbleAmp: 3,  glowRadius: 18, glowAlpha: 0.4 },
  talking: { wobbleSpeed: 1.5,  wobbleAmp: 4,  glowRadius: 10, glowAlpha: 0.25 },
  moving:  { wobbleSpeed: 0,    wobbleAmp: 0,  glowRadius: 5,  glowAlpha: 0.15 },
};
