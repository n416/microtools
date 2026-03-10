import fs from 'fs';

const files = [
  'prologue1', 'prologue2', 'prologue3',
  'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep5_5', 'ep6', 
  'ep7_1', 'ep7_2', 'ep7_3', 'ep8', 
  'ep9_0', 'ep9_1', 'ep9_2',
  'ep10_0', 'ep10_1', 'ep10_2', 'ep10_3', 'ep10_4', 'ep10_5', 'ep10_6', 'ep10_7',
  'ep11', 'ep11_1', 'ep11_2',
  'ep12', 'ep12_5', 'ep13_0', 'ep13_0_5', 'ep13_0_6', 'ep13_1', 
  'ep14', 'ep14_5', 'ep15',
  'ep16_1', 'ep16_2', 'ep16_3', 'ep16_4', 
  'ep17', 'ep18', 'ep19',
  'lore_lin_hidden', 'lore_kurosu_hidden'
];

function sortNumeric(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

const eps = files.filter(f => f.startsWith('ep'));
eps.sort(sortNumeric);

fs.writeFileSync('eval_out2.txt', eps.join('\n'));
