/**
 * 轻量级图像 prompt 清洗器。
 *
 * 某些图像模型（如 Agnes）对涉及暴力、色情、赌博、毒品等关键词的 prompt
 * 会返回 content_policy_violation。该函数在发送前把高风险词替换为空格，
 * 降低误触发概率，同时尽量保留场景/角色的视觉描述。
 */

const RISKY_PATTERNS = [
  // English
  '\\bnsfw\\b',
  '\\bnude\\b',
  '\\bnaked\\b',
  '\\bsex\\b',
  '\\bsexual\\b',
  '\\bporn\\b',
  '\\bpornographic\\b',
  '\\berotic\\b',
  '\\bkill\\b',
  '\\bkilling\\b',
  '\\bmurder\\b',
  '\\bmurdered\\b',
  '\\bdeath\\b',
  '\\bdead\\b',
  '\\bblood\\b',
  '\\bbloody\\b',
  '\\bviolence\\b',
  '\\bviolent\\b',
  '\\bsuicide\\b',
  '\\btorture\\b',
  '\\brape\\b',
  '\\babuse\\b',
  '\\bdrug\\b',
  '\\bdrugs\\b',
  '\\bgambling\\b',
  '\\bcasino\\b',
  '\\bhostage\\b',
  '\\bkidnap\\b',
  '\\bterrorist\\b',
  '\\bbomb\\b',
  '\\bexplosion\\b',
  '\\bweapon\\b',
  '\\bgun\\b',
  '\\bknife\\b',
  '\\bwar\\b',
  '\\bbattle\\b',
  '\\bfight\\b',
  '\\bcorpse\\b',
  // Chinese
  '裸体',
  '色情',
  '性行为',
  '性虐待',
  '强暴',
  '强奸',
  '淫秽',
  '猥亵',
  '谋杀',
  '杀人',
  '被杀',
  '死亡',
  '死去',
  '尸体',
  '自杀',
  '自残',
  '绑架',
  '劫持',
  '恐怖',
  '爆炸',
  '炸弹',
  '武器',
  '枪支',
  '枪械',
  '血腥',
  '暴力',
  '虐待',
  '毒品',
  '吸毒',
  '赌博',
  '赌局',
  '赌场',
  '屠杀',
  '杀戮',
  '战争',
  '战斗',
  '打架',
  '斗殴',
  '砍杀',
  '刺杀',
  '行凶',
  '犯罪',
  '罪犯',
  '监狱',
  '牢房',
  '手铐',
  '血泊',
];

const RISKY_REGEX = new RegExp(RISKY_PATTERNS.join('|'), 'gi');

export function sanitizeImagePrompt(prompt: string): string {
  return prompt
    .replace(RISKY_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
