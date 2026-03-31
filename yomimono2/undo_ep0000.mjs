import fs from 'fs';
import path from 'path';

const fPath = './public/settings/ep0000.mdx';
let text = fs.readFileSync(fPath, 'utf8');

const reverts = [
  {target: '　煤にまみれた少年が、放っておけば確実に失明に至る熱病で苦しそうに呻いている。', replace: '　煤にまみれた少年が、放っておけば確実に失明に至る熱病に浮かされ苦しそうに呻いている。'},
  {target: '　長きにわたり分厚い氷で覆ってきたはずの感情の防壁が、派手な音を立て決壊した。', replace: '　長きにわたり、分厚い氷で覆い隠してきたはずの感情の防壁が、派手な音を立てて決壊した。'},
  {target: '　目じりに涙まで浮かべて怒り狂う少女（三百歳）を見て、ヴィランが忌々しげに舌打ちした。', replace: '　目じりに涙まで浮かべて怒り狂う少女（三百歳）を見て、ヴィランが忌々しげに舌打ちをした。'},
  {target: '「だから聞いてるんだ。——なあ、それで延命させたお前の奥さん、最後は幸せそうだったか」', replace: '「だから聞いてるんだ。——なあ、それで延命させたお前の奥さん、最後は幸せそうだったか？」'}
];

for(const rev of reverts) {
  text = text.replace(rev.target, rev.replace);
}
fs.writeFileSync(fPath, text, 'utf8');
console.log('Reverted ep0000.mdx');
