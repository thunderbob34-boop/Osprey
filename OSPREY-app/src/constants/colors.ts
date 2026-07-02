// OSPREY Design System — Color Tokens
// Matches the frosted glass design language in the wireframes

export const Colors = {
  // Brand
  teal:       '#00c8c8',
  tealDark:   '#00a0a0',
  tealDim:    'rgba(0,200,200,0.12)',
  gold:       '#c89a00',
  goldDim:    'rgba(200,154,0,0.12)',
  navy:       '#1B3A5C',

  // Backgrounds
  bg:         '#060912',
  bgCard:     'rgba(255,255,255,0.04)',
  bgCardHover:'rgba(255,255,255,0.07)',

  // Surfaces (frosted glass)
  surfaceTeal:'rgba(0,200,200,0.06)',
  surfaceGold:'rgba(200,154,0,0.07)',
  surfacePink:'rgba(173,20,87,0.07)',

  // Borders
  border:     'rgba(255,255,255,0.08)',
  borderTeal: 'rgba(0,200,200,0.2)',
  borderGold: 'rgba(200,154,0,0.25)',

  // Text
  textPrimary:   '#ffffff',
  textSecondary: 'rgba(255,255,255,0.55)',
  // 0.3 alpha on #060912 is ~2.3:1 contrast, well under WCAG AA's 4.5:1 for
  // body text; textMuted is used for field labels, hints, and placeholders
  // throughout the app, not just decorative chrome. 0.48 lands at ~5:1.
  textMuted:     'rgba(255,255,255,0.48)',

  // Status
  green:   '#4cde80',
  amber:   '#f5a623',
  red:     '#ff4444',
  pink:    '#e91e8c',

  // Recovery tank
  recoveryGreen: '#26a84d',
  recoveryAmber: '#b85a00',
  recoveryRed:   '#cc2222',

  // Sport surfaces (Swim, Bike cards)
  surfaceBlue:  'rgba(0,100,200,0.07)',
  surfaceGreen: 'rgba(76,222,128,0.06)',
  borderBlue:   'rgba(0,100,200,0.2)',
  borderGreen:  'rgba(76,222,128,0.2)',
} as const;
