import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CharacterNames } from '../src/character_dictionary.js';
import { ItTermDictionary } from '../src/it_term_dictionary.js';
import { TermDictionary } from '../src/term_dictionary.js';
import { TermFirstAppearanceMap } from '../src/term_map.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.join(__dirname, '../public/settings');

const CPL = 42;

// Ordered by safety and preference
const safeReductions = [
    { regex: /なんとか/g, replace: '' },
    { regex: /ふとした(瞬間に?|時)/g, replace: '$1' },
    { regex: /少し(だけ)?/g, replace: '' },
    { regex: /そのまま/g, replace: '' },
    { regex: /さっき(の)?/g, replace: '' },
    { regex: /小さく/g, replace: '' },
    { regex: /自身の/g, replace: '' },
    { regex: /彼の/g, replace: '' },
    { regex: /彼女の/g, replace: '' },
    { regex: /どうやら/g, replace: '' },
    { regex: /おそらく/g, replace: '' },
    { regex: /わざわざ/g, replace: '' },
    { regex: /どこか/g, replace: '' },
    { regex: /なんとなく/g, replace: '' },
    { regex: /再び/g, replace: 'また' },
    { regex: /なぜか/g, replace: '' },
    { regex: /ひどく/g, replace: '' },
    { regex: /ただの/g, replace: '' },
    { regex: /完全に/g, replace: '' },
    { regex: /まるで/g, replace: '' },
    { regex: /ことだった/g, replace: 'ことだ' },
    { regex: /という/g, replace: '' },
    { regex: /(?<!ん)ような/g, replace: 'な' },
    { regex: /ている/g, replace: 'てる' },
    { regex: /ことなど/g, replace: 'など' },
    { regex: /ことすら/g, replace: 'すら' },
    { regex: /について/g, replace: 'に' },
    { regex: /からこそ/g, replace: 'から' },
    { regex: /である/g, replace: 'だ' },
    { regex: /となっている/g, replace: 'となってる' },
    { regex: /てある/g, replace: 'たる' },
    { regex: /ておく/g, replace: 'とく' },
];

function resolveCharacters(text) {
  return text.replace(/<Char\s+role="([^"]+)"(?:\s+callrole="([^"]+)")?\s+var="([^"]+)"\s*\/>/g, (match, role, callrole, variant) => {
    const charData = CharacterNames[role];
    if (!charData) return `[Unknown Char: ${role}]`;
    if (variant === 'furigana' || variant === 'age') return charData[variant] || `[Unknown Prop: ${variant}]`;
    if (callrole) {
      if (charData.callers?.[callrole]?.[variant]) return charData.callers[callrole][variant];
      if (charData.callers?.system?.[variant]) return charData.callers.system[variant];
      return `[Unknown Var: ${role}/${callrole} or system/${variant}]`;
    }
    return `[Missing CallRole: ${role}]`;
  });
}

function resolveTerms(text, currentEpisode, mode = 'expert') {
  const combinedDictionary = { ...ItTermDictionary, ...TermDictionary };
  const localSeen = new Set();
  return text.replace(/<Term\s+id="([^"]+)"(?:\s*>([\s\S]*?)<\/Term>|\s*\/>)/g, (match, id, innerText) => {
    const termData = combinedDictionary[id];
    if (!termData) return `[Unknown Term: ${id}]`;
    const displayStr = (innerText && innerText.trim().length > 0) ? innerText : termData.term;
    if (mode === 'ruby-p2') {
      if (termData.skip_print_ruby) return displayStr;
      const rubyText = termData.print_ruby || termData.simple_term;
      if (rubyText && TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
        localSeen.add(id);
        return `${displayStr}《${rubyText}》`;
      }
      localSeen.add(id);
      return displayStr;
    }
    return displayStr;
  });
}

let totalLinesSaved = 0;

try {
    const files = fs.readdirSync(settingsDir);
    files.filter(f => f.endsWith('.mdx')).forEach(file => {
        const filePath = path.join(settingsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let lines = content.split(/\r?\n/);
        let fileChanged = false;

        for (let i = 0; i < lines.length; i++) {
            let originalLine = lines[i];
            
            const currentEpisode = file.replace('.mdx', '');
            
            // Exact resolution logic used in output_novel_ruby_p2
            let charResolved = resolveCharacters(originalLine);
            let fullyResolved = resolveTerms(charResolved, currentEpisode, 'ruby-p2');
            
            let resolvedLine = fullyResolved
                .replace(/｜(.+?)《.+?》/g, '$1')
                .replace(/(!\?|\?\!|!!|\d{2})/g, 'X')
                .replace(/…/g, '︙'); // postbuild_mdx replaces this
                
            let displayLength = resolvedLine.length;
            
            if (displayLength > 0) {
                let remainder = displayLength % CPL;
                
                // If it overhangs by 1 to 12 characters
                if (remainder >= 1 && remainder <= 12) {
                    let newLine = originalLine;
                    let newLength = displayLength;
                    
                    for (let {regex, replace} of safeReductions) {
                        let tempLine = newLine.replace(regex, replace);
                        
                        let tCharResolved = resolveCharacters(tempLine);
                        let tFullyResolved = resolveTerms(tCharResolved, currentEpisode, 'ruby-p2');
                        
                        let tempResolved = tFullyResolved
                            .replace(/｜(.+?)《.+?》/g, '$1')
                            .replace(/(!\?|\?\!|!!|\d{2})/g, 'X')
                            .replace(/…/g, '︙');
                            
                        let tempCleanLength = tempResolved.length;
                        
                        // Check if we saved enough characters to eliminate the overhang
                        if (tempCleanLength < newLength && tempCleanLength <= displayLength - remainder) {
                            newLine = tempLine;
                            newLength = tempCleanLength;
                            break; // Stop after first successful line-saving reduction
                        }
                    }
                    
                    if (newLine !== originalLine) {
                        lines[i] = newLine;
                        fileChanged = true;
                        totalLinesSaved += 1;
                    }
                }
            }
        }
        
        if (fileChanged) {
            fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
            console.log(`Updated ${file}`);
        }
    });

    console.log(`Targeted Trim completed. Saved approx ${totalLinesSaved} lines!`);
} catch(e) {
    console.error(e);
}
