export type ScreenKey = 'run' | 'strength' | 'nutrition' | 'coach';

export interface Screen {
  mode: string;
  label: string;
  metric: string;
  viz: string;
  coach: string;
}

export const SCREENS: Record<ScreenKey, Screen> = {
  run: {
    mode: 'Live run',
    label: 'Tempo run · Mile 4 of 6',
    metric: '7:42 /MI',
    viz:
      '<div class="viz"><div class="viz-title">Mile splits</div>' +
      '<div class="splits">' +
      '<div class="split"><div class="fill" style="height:62%"></div><div class="t">8:04</div></div>' +
      '<div class="split"><div class="fill" style="height:70%"></div><div class="t">7:55</div></div>' +
      '<div class="split"><div class="fill" style="height:78%"></div><div class="t">7:48</div></div>' +
      '<div class="split cur"><div class="fill" style="height:84%"></div><div class="t">7:42</div></div>' +
      '<div class="split"><div class="fill" style="height:12%"></div><div class="t">—</div></div>' +
      '<div class="split"><div class="fill" style="height:12%"></div><div class="t">—</div></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> Pace is drifting 6s hot on this hill. Ease off, hold effort steady.',
  },
  strength: {
    mode: 'Live session',
    label: 'Upper body · Set 3 of 4',
    metric: '185 LB × 8',
    viz:
      '<div class="viz"><div class="viz-title">Bench press · Working sets</div>' +
      '<div class="sets">' +
      '<div class="set-row"><span class="n">Set 1</span><span class="blocks"><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span></span><span class="v">185 × 8 ✓</span></div>' +
      '<div class="set-row"><span class="n">Set 2</span><span class="blocks"><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span></span><span class="v">185 × 8 ✓</span></div>' +
      '<div class="set-row cur"><span class="n">Set 3</span><span class="blocks"><span class="blk done"></span><span class="blk done"></span><span class="blk"></span><span class="blk"></span></span><span class="v">185 × 8</span></div>' +
      '<div class="set-row"><span class="n">Set 4</span><span class="blocks"><span class="blk"></span><span class="blk"></span><span class="blk"></span><span class="blk"></span></span><span class="v">—</span></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> Last week you hit 6 at this weight. Good progression, rest 90s.',
  },
  nutrition: {
    mode: 'Fuel log',
    label: 'Today · Post-workout',
    metric: '142G PROTEIN',
    viz:
      '<div class="viz"><div class="viz-title">Daily targets</div>' +
      '<div class="macros">' +
      '<div class="macro"><div class="m-head"><span>Protein</span><span><b>142</b> / 180g</span></div><div class="track"><div class="fill" style="width:79%"></div><div class="target" style="left:100%"></div></div></div>' +
      '<div class="macro"><div class="m-head"><span>Carbs</span><span><b>226</b> / 310g</span></div><div class="track"><div class="fill" style="width:73%"></div><div class="target" style="left:100%"></div></div></div>' +
      '<div class="macro"><div class="m-head"><span>Fat</span><span><b>58</b> / 75g</span></div><div class="track"><div class="fill" style="width:77%"></div><div class="target" style="left:100%"></div></div></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> 38g to target. A recovery shake now beats chasing it at dinner.',
  },
  coach: {
    mode: 'Daily brief',
    label: 'Thursday · Race week -10',
    metric: 'DELOAD DAY',
    viz:
      '<div class="viz"><div class="viz-title">This week · 31 of 34 mi</div>' +
      '<div class="week">' +
      '<div class="day done"><div class="box"></div><div class="d">M</div></div>' +
      '<div class="day done"><div class="box"></div><div class="d">T</div></div>' +
      '<div class="day done"><div class="box"></div><div class="d">W</div></div>' +
      '<div class="day today"><div class="box"></div><div class="d">T</div></div>' +
      '<div class="day"><div class="box"></div><div class="d">F</div></div>' +
      '<div class="day"><div class="box"></div><div class="d">S</div></div>' +
      '<div class="day"><div class="box"></div><div class="d">S</div></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> Legs logged 31 miles this week. Today we bank recovery — trust the plan.',
  },
};

export function renderScreen(key: ScreenKey): string {
  const s = SCREENS[key];
  return (
    `<div class="dev-label">${s.label}</div>` +
    `<div class="dev-metric">${s.metric}</div>` +
    s.viz +
    `<div class="coach">${s.coach}</div>`
  );
}
