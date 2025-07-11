const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const BASE_NOTES = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const DEFAULT_FLATS = new Set([1,3,8,10]);

function noteToSemitone(note){
    note = note.replace(/\d/g, '');
    const m = note.match(/^([A-G])(bb?|##?)?$/);
    if(!m) return -1;
    let semi = BASE_NOTES[m[1]];
    const acc = m[2] || '';
    for(const ch of acc){
        if(ch==='b') semi--;
        if(ch==='#') semi++;
    }
    return (semi+120)%12;
}

function semitoneToNote(semi){
    return NOTES_SHARP[semi % 12];
}

function semitoneToNoteFlat(semi){
    return NOTES_FLAT[semi % 12];
}

function simplifySuffix(suf){
    const original = suf;
    suf = suf.replace(/∆/g,'maj7');
    const hadExt = /(9|11|13)/.test(suf);
    suf = suf.replace(/9|11|13|add9/g,'');
    suf = suf.replace(/\([^)]*\)/g, '');
    suf = suf.replace(/^(?:-|mi|min)/i,'m');
    suf = suf.replace(/dim7?|dis7?/i, m => m.toLowerCase().includes('7') ? 'º7' : 'º');
    suf = suf.replace(/ø/,'m7(b5)');
    if(/maj(?!7)/i.test(suf)) suf = suf.replace(/maj(?!7)/i,'maj7');
    const has7 = /7/.test(suf);
    const hasMaj = /maj7/.test(suf);
    if(hadExt && !has7 && !hasMaj){
        suf += '7';
    }
    return suf;
}

const SCALE_PRIORITY = ['Mayor','MenorArmonica','MenorMelodica','MayorArmonica'];

const SCALE_DATA = {
    'Mayor': {
        intervals: [0,2,4,5,7,9,11],
        chords: [
            ['', '6', 'maj7'],
            ['m','m7'],
            ['m','m7'],
            ['', '6', 'maj', 'maj7'],
            ['', '7','sus4','7sus4'],
            ['m','m7'],
            ['º','m7(b5)']
        ],
        functions: ['T','S','T','S','D','T','D']
    },
    'MenorArmonica': {
        intervals: [0,2,3,5,7,8,11],
        chords: [
            ['m','mmaj7'],
            ['º','m7(b5)'],
            ['+','+maj7'],
            ['m','m6','m7'],
            ['','7','sus4','7sus4'],
            ['','maj7'],
            ['º','º7']
        ],
        functions: ['T','S','T','S','D','T','D']
    },
    'MenorMelodica': {
        intervals: [0,2,3,5,7,9,11],
        chords: [
            ['m','m6','mmaj7'],
            ['m','m7','sus4','7sus4','7sus4b9','sus4addb2'],
            ['b5','b5maj7'],
            ['','7','b5','7b5'],
            ['','7','sus4','7sus4'],
            ['º','m7(b5)'],
            ['+','b5','+7','b57']
        ],
        functions: ['T','S','T','S','D','T','D']
    },
    'MayorArmonica': {
        intervals: [0,2,4,5,7,8,11],
        chords: [
            ['+','+maj7'],
            ['º','m7(b5)'],
            ['','7','+','+7'],
            ['m','m6','mmaj7'],
            ['','7','sus4','7sus4'],
            ['+','+maj7'],
            ['º','º7']
        ],
        functions: ['T','S','D','S','D','T','D']
    }
};

function parseChord(token){
    const match = token.match(/^([A-G](?:bb?|##?)?)(.*)$/);
    if(!match) return null;
    return {root:match[1], suffix: simplifySuffix(match[2])};
}

function chordMatchesScale(chord, keyRoot, scale){
    const data = SCALE_DATA[scale];
    const semiRoot = noteToSemitone(chord.root);
    const semiKey = noteToSemitone(keyRoot);
    if(semiRoot===-1||semiKey===-1) return null;
    const diff = (semiRoot - semiKey + 12)%12;
    const idx = data.intervals.indexOf(diff);
    if(idx===-1) return null;
    const sufs = data.chords[idx];
    const suf = chord.suffix;
    if(sufs.includes(suf)) return idx;
    // allow empty suffix match
    if(suf==='' && sufs.includes('')) return idx;
    return null;
}

function guessKey(chords){
    let best = null;
    for(const scale of SCALE_PRIORITY){
        for(let semi=0; semi<12; semi++){
            const note = semitoneToNote(semi);
            let score = 0;
            for(const ch of chords){
                if(chordMatchesScale(ch, note, scale)!==null) score++;
            }
            if(!best || score>best.score){
                best = {score, semi, scale};
            }
        }
    }
    if(!best) return null;
    const flatCount = chords.filter(c=>/b/.test(c.root)).length;
    const sharpCount = chords.filter(c=>/#/.test(c.root)).length;
    let preferFlat;
    if(flatCount!==sharpCount){
        preferFlat = flatCount>sharpCount;
    } else {
        preferFlat = DEFAULT_FLATS.has(best.semi);
    }
    const note = preferFlat ? semitoneToNoteFlat(best.semi) : semitoneToNote(best.semi);
    return {score:best.score, note, scale:best.scale};
}

const V_CHORD_REGEX = /^(?:7(?:b5|\(b5\))?|\+7|7)$/;

function isSubVMaj7(ch, next, key){
    if(!next) return false;
    if(ch.suffix !== 'maj7') return false;
    const diff = (noteToSemitone(ch.root) - noteToSemitone(next.root) + 12)%12;
    if(diff!==1) return false;
    if(!key) return true;
    return chordMatchesScale(ch, key.note, key.scale)===null;
}

function isSubV(ch, next){
    if(!next) return false;
    const diff = (noteToSemitone(ch.root) - noteToSemitone(next.root) + 12)%12;
    return diff===1 && V_CHORD_REGEX.test(ch.suffix);
}

function possibleAnalysesForChord(ch){
    const DEG = ['I','II','III','IV','V','VI','VII'];
    const hasFlat = /b/.test(ch.root);
    const hasSharp = /#/.test(ch.root);
    const noteFn = hasFlat ? semitoneToNoteFlat : hasSharp ? semitoneToNote : (s => (DEFAULT_FLATS.has(s) ? semitoneToNoteFlat(s) : semitoneToNote(s)));
    const out = [];
    for(const scale of SCALE_PRIORITY){
        for(let semi=0; semi<12; semi++){
            const note = noteFn(semi);
            const idx = chordMatchesScale(ch, note, scale);
            if(idx!==null){
                out.push({key:{note, scale}, degree:DEG[idx], func:SCALE_DATA[scale].functions[idx]});
            }
        }
    }
    return out;
}

function analyzeProgression(str){
    const tokens = str.trim().split(/\s+/);
    const chords = tokens.map(parseChord).filter(x=>x);
    const globalKey = guessKey(chords);
    const DEG = ['I','II','III','IV','V','VI','VII'];
    const result = [];
    const overrides = Array(chords.length).fill(null);
    chords.forEach((ch, i) => {
        let key = globalKey;
        let idx = chordMatchesScale(ch, key.note, key.scale);
        if(idx===null){
            key = guessKey(chords.slice(i));
            idx = chordMatchesScale(ch, key.note, key.scale);
            if(idx===null){
                key = guessKey([ch]);
                idx = chordMatchesScale(ch, key.note, key.scale);
            }
        }
        let degree = idx!==null ? DEG[idx] : '?';
        let func = idx!==null ? SCALE_DATA[key.scale].functions[idx] : 'X';

        if(overrides[i]){
            degree = overrides[i].degree;
            func = overrides[i].func;
        }
        const next = chords[i+1];
        if(isSubV(ch, next)){
            let nKey = {note:globalKey.note, scale:globalKey.scale};
            let nidx = next ? chordMatchesScale(next, nKey.note, nKey.scale) : null;
            if(nidx===null && next){
                nKey = guessKey([next]);
                nidx = chordMatchesScale(next, nKey.note, nKey.scale);
            }
            const nd = nidx!==null ? DEG[nidx] : '?';
            degree = 'subV';
            func = 'D';
        } else if(isSubVMaj7(ch, next, globalKey)){
            degree = 'subV∆';
            func = 'D';
        } else if(next){
            const diff = (noteToSemitone(ch.root) - noteToSemitone(next.root) + 12)%12;
            if(diff===7 && V_CHORD_REGEX.test(ch.suffix)){
                let nKey = {note:globalKey.note, scale:globalKey.scale};
                let nidx = chordMatchesScale(next, nKey.note, nKey.scale);
                if(nidx===null){
                    nKey = guessKey([next]);
                    nidx = chordMatchesScale(next, nKey.note, nKey.scale);
                }
                const nd = nidx!==null ? DEG[nidx] : '?';
                degree = nd==='I' || nd==='?' ? 'V' : `V/${nd}`;
            }
            // Detect II-V pairs
            const nextNext = chords[i+2];
            const diffIV = (noteToSemitone(next.root) - noteToSemitone(ch.root) + 12)%12;
            const isIIm = /(m7\(b5\)|ø|m7)$/.test(ch.suffix);
            const isV7 = V_CHORD_REGEX.test(next.suffix);
            if(nextNext && diffIV===5 && isIIm && isV7){
                let tKey = {note:globalKey.note, scale:globalKey.scale};
                let tidx = chordMatchesScale(nextNext, tKey.note, tKey.scale);
                if(tidx===null){
                    tKey = guessKey([nextNext]);
                    tidx = chordMatchesScale(nextNext, tKey.note, tKey.scale);
                }
                const td = tidx!==null ? DEG[tidx] : '?';
                const diffVT = (noteToSemitone(nextNext.root) - noteToSemitone(next.root) + 12)%12;
                const diffTV = (noteToSemitone(next.root) - noteToSemitone(nextNext.root) + 12)%12;
                if(diffVT===5){
                    if(td!=='I'){
                    degree = `II${/m7\(b5\)|ø/.test(ch.suffix)?'ø':''}/${td}`;
                    overrides[i+1] = {degree:'V', func:'D'};
                    }
                } else if(diffTV===1){
                    degree = `subII/${td}`;
                    overrides[i+1] = {degree:'subV', func:'D'};
                } else if(diffVT===2){
                    degree = `back_door/${td}`;
                    overrides[i+1] = {degree:'back_door', func:'D'};
                }
            }
        }
        if((degree==='?' || degree==='VII') && /(m7\(b5\)|m7)$/.test(ch.suffix)){
            for(let skip=1; skip<=2; skip++){
                const target = chords[i+skip+1];
                if(!target) break;
                const diff = (noteToSemitone(ch.root) - noteToSemitone(target.root) + 12) % 12;
                if(diff===2){
                    if(skip===1 || (skip===2 && chords[i+1] && chords[i+2])){
                        if(skip===2){
                            const diffIV2 = (noteToSemitone(chords[i+2].root) - noteToSemitone(chords[i+1].root) + 12) % 12;
                            const isIIm2 = /(m7\(b5\)|ø|m7)$/.test(chords[i+1].suffix);
                            const isV72 = V_CHORD_REGEX.test(chords[i+2].suffix);
                            if(!(diffIV2===5 && isIIm2 && isV72)) continue;
                        }
                        let tKey = {note: globalKey.note, scale: globalKey.scale};
                        let tidx = chordMatchesScale(target, tKey.note, tKey.scale);
                        if(tidx===null){
                            tKey = guessKey([target]);
                            tidx = chordMatchesScale(target, tKey.note, tKey.scale);
                        }
                        const td = tidx!==null ? DEG[tidx] : '?';
                        degree = `II${/m7\(b5\)/.test(ch.suffix)?'ø':''}/${td}`;
                        break;
                    }
                }
            }
        }
        result.push({chord:ch, degree, func, key});
    });
    const segments = [];
    let curKey = globalKey;
    let start = 0;
    for(let i=0;i<chords.length;i++){
        const ch = chords[i];
        const deg = result[i].degree;
        if(/^(subV∆?|subII|back_door)/.test(deg) || /^V\/.+/.test(deg)) continue;
        if(chordMatchesScale(ch, curKey.note, curKey.scale)===null){
            const restKey = guessKey(chords.slice(i));
            if(restKey && (restKey.note!==curKey.note || restKey.scale!==curKey.scale)){
                segments.push({key:curKey, chords:tokens.slice(start,i)});
                start = i;
                curKey = restKey;
            }
        }
    }
    segments.push({key:curKey, chords:tokens.slice(start)});
    return {key: globalKey, analysis:result, segments};
}

function dominantFor(root){
    const semi = (noteToSemitone(root)+7)%12;
    const preferFlat = root.includes('b');
    return (preferFlat ? semitoneToNoteFlat(semi) : semitoneToNote(semi))+"7";
}
function subVFor(root){
    const semi = (noteToSemitone(root)+1)%12;
    return semitoneToNoteFlat(semi)+"7";
}
function relIIFor(root, suffix=''){
    const semi = (noteToSemitone(root)+2)%12;
    const preferFlat = root.includes('b');
    const note = preferFlat ? semitoneToNoteFlat(semi) : semitoneToNote(semi);
    if(/^m(?!aj)/.test(suffix)){
        return note+"m7(b5)";
    }
    return note+"m7";
}
function subIIFor(root){
    const semi = (noteToSemitone(root)+8)%12;
    return semitoneToNoteFlat(semi)+"m7";
}

function subIIForSubV(root){
    const semi = (noteToSemitone(root)+7)%12;
    return semitoneToNoteFlat(semi)+"m7";
}
function dimUp(root){
    const semi = (noteToSemitone(root)+11)%12;
    const preferFlat = root.includes('b');
    return (preferFlat ? semitoneToNoteFlat(semi) : semitoneToNote(semi))+"º7";
}

function subVMaj7For(root){
    const semi = (noteToSemitone(root)+1)%12;
    return semitoneToNoteFlat(semi)+"maj7";
}

function backDoorFor(root){
    const semiIV = (noteToSemitone(root)+5)%12;
    const semiVIIb = (noteToSemitone(root)+10)%12;
    return [semitoneToNoteFlat(semiIV)+"m7", semitoneToNoteFlat(semiVIIb)+"7"];
}

function lineClicheFor(root, suffix='', degree=null){
    if(/^m(?:7|6)?$/.test(suffix)){
        return [root+"m", root+"mmaj7", root+"m7", root+"m6"];
    }
    if(/^(?:|6|maj7)$/.test(suffix)){
        return [root, root+"+", root+"6"];
    }
    if(degree && /^V/.test(degree)){
        return [root+"7b5", root+"7", root+"+7", root+"13"];
    }
    return null;
}

function noteForDegree(keyRoot, degree, scale='Mayor'){
    const idxMap = {I:0, II:1, III:2, IV:3, V:4, VI:5, VII:6};
    const idx = idxMap[degree];
    const scaleData = SCALE_DATA[scale];
    if(!scaleData) return keyRoot;
    const interval = scaleData.intervals[idx];
    const semi = (noteToSemitone(keyRoot)+interval)%12;
    const preferFlat = keyRoot.includes('b');
    return preferFlat ? semitoneToNoteFlat(semi) : semitoneToNote(semi);
}

function defaultSuffixForDegree(scale, degree){
    const idxMap = {I:0,II:1,III:2,IV:3,V:4,VI:5,VII:6};
    const sufs = SCALE_DATA[scale].chords[idxMap[degree]];
    const order = ['maj7','m7','7sus4','7','m7(b5)','m','maj',''];
    for(const pref of order){
        if(sufs.includes(pref)) return pref;
    }
    return sufs[0] || '';
}

function simpleSubstitutions(root, suffix, degree, keyRoot, keyScale){
    if(!degree || !keyRoot || !keyScale) return [];
    const groups = {
        G1:['I','III','VI'],
        G2:['II','IV','V7sus4'],
        G3:['V','VII','V7sus4']
    };
    let group = null;
    const isV7sus4 = degree==='V' && /sus4/.test(suffix);
    const isVtsus4 = noteToSemitone(root)===(noteToSemitone(keyRoot)+1)%12 && /sus4/.test(suffix);
    if(groups.G1.includes(degree)) group = 'G1';
    else if(groups.G2.includes(degree) || isV7sus4) group = 'G2';
    else if(groups.G3.includes(degree) || isV7sus4) group = 'G3';
    if(!group) return [];

    const candidates = [];
    if(group==='G1'){
        for(const deg of groups.G1){
            if(deg!==degree){
                const suf = defaultSuffixForDegree(keyScale, deg);
                candidates.push(noteForDegree(keyRoot, deg, keyScale)+suf);
            }
        }
    } else if(group==='G2'){
        if(degree!=='II') {
            const suf = defaultSuffixForDegree(keyScale,'II');
            candidates.push(noteForDegree(keyRoot,'II', keyScale)+suf);
        }
        if(degree!=='IV') {
            const suf = defaultSuffixForDegree(keyScale,'IV');
            candidates.push(noteForDegree(keyRoot,'IV', keyScale)+suf);
        }
        if(!isV7sus4) candidates.push(noteForDegree(keyRoot,'V', keyScale)+'7sus4');
    } else if(group==='G3'){
        const vRoot = noteForDegree(keyRoot,'V', keyScale);
        const vSuffix = defaultSuffixForDegree(keyScale,'V');
        const viiRoot = noteForDegree(keyRoot,'VII', keyScale);
        const viiSuffix = defaultSuffixForDegree(keyScale,'VII');

        if(degree==='V'){
            candidates.push(viiRoot+viiSuffix);
            if(/sus4/.test(suffix)) candidates.push(vRoot+vSuffix);
            else candidates.push(vRoot+'7sus4');
        } else if(degree==='VII'){
            candidates.push(vRoot+vSuffix);
            candidates.push(vRoot+'7sus4');
        } else { // Vtsus4
            candidates.push(vRoot+vSuffix);
            candidates.push(viiRoot+viiSuffix);
        }
    }
    return candidates;
}

function modalInterchangeChords(degree, keyRoot, keyScale){
    const idxMatch = degree && degree.match(/^(VII|VI|V|IV|III|II|I)/);
    if(!idxMatch || !keyRoot || !keyScale) return [];
    const deg = idxMatch[1];
    const idxMap = {I:0,II:1,III:2,IV:3,V:4,VI:5,VII:6};
    const out = [];
    for(const sc of SCALE_PRIORITY){
        if(sc === keyScale) continue;
        const note = noteForDegree(keyRoot, deg, sc);
        const sufs = SCALE_DATA[sc].chords[idxMap[deg]];
        const chords = sufs.map(s => note + s);
        const def = note + defaultSuffixForDegree(sc, deg);
        out.push({scale:sc, chords, defaultChord:def});
    }
    return out;
}

function reharmonizationOptions(root, suffix='', degree=null, keyRoot=null, keyScale=null){
    const opts = [];
    const isDim = /(dim|º|dim7|º7|m7\(b5\))/i.test(suffix);

    if(degree && degree.startsWith('subII')){
        const lc = lineClicheFor(root, suffix, degree);
        if(lc) opts.push({name:'Line clich\u00e9', chords:lc});
        return opts;
    }

    if(degree==='subV' || degree==='subV∆'){
        if(degree==='subV'){
            opts.push({name:'SubII previo', chords:[subIIForSubV(root), root+suffix]});
        }
        const lc = lineClicheFor(root, suffix, 'V');
        if(lc) opts.push({name:'Line clich\u00e9', chords:lc});
        return opts;
    }

    for(const sub of simpleSubstitutions(root, suffix, degree, keyRoot, keyScale)){
        opts.push({name:`Sustituci\u00f3n simple (${sub})`, chords:[sub]});
    }

    for(const mod of modalInterchangeChords(degree, keyRoot, keyScale)){
        const label = `${mod.scale}: ${mod.chords.join(', ')}`;
        opts.push({name:`Intercambio modal (${label})`, chords:[mod.defaultChord]});
    }

    const lc = lineClicheFor(root, suffix, degree);
    if(lc){
        opts.push({name:'Line clich\u00e9', chords:lc});
    }

    if(!isDim){
        opts.push({name:'Dominante previo', chords:[dominantFor(root)]});
        opts.push({name:'II-V previo', chords:[relIIFor(root, suffix), dominantFor(root)]});
        opts.push({name:'II-subV previo', chords:[relIIFor(root, suffix), subVFor(root)]});
        opts.push({name:'SubV previo', chords:[subVFor(root)]});
        opts.push({name:'SubVmaj7 previo', chords:[subVMaj7For(root)]});
        opts.push({name:'SubII-SubV previo', chords:[subIIFor(root), subVFor(root)]});
        opts.push({name:'Aprox. ascendente previo', chords:[dimUp(root)]});
        opts.push({name:'Back door previo', chords:backDoorFor(root)});
    }
    return opts;
}

function initRearmonizador(options = {}) {
    if (typeof document === 'undefined') return;
    const defaults = {
        chords: '[data-chords], #chords',
        analyzeBtn: '[data-analyze], #analyzeBtn',
        clearBtn: '[data-clear], #clearBtn',
        analysis: '[data-analysis], #analysis',
        result: '[data-result], #resultChords'
    };
    const selectors = Object.assign({}, defaults, options.selectors);

    const chordsInput = document.querySelector(selectors.chords);
    const analyzeBtn = document.querySelector(selectors.analyzeBtn);
    const clearBtn = document.querySelector(selectors.clearBtn);
    const analysisDiv = document.querySelector(selectors.analysis);
    const resultArea = document.querySelector(selectors.result);
    if (!chordsInput || !analyzeBtn || !clearBtn || !analysisDiv || !resultArea) {
        throw new Error('Missing DOM elements for rearmonizador');
    }

    let originalTokens = [];
    let currentTokens = [];
    let reharmonizations = [];
    let chordTokenIndices = [];
    let analysisChoices = [];
    let selectedAnalyses = [];

    analyzeBtn.addEventListener('click', () => {
        const txt = chordsInput.value;
        originalTokens = txt.trim().split(/\s+/).filter(t => t);
        reharmonizations = new Array(originalTokens.length).fill(null);
        currentTokens = [...originalTokens];
        chordTokenIndices = [];
        originalTokens.forEach((t,i)=>{ if(parseChord(t)) chordTokenIndices.push(i); });
        const res = analyzeProgression(txt);
        analysisDiv.innerHTML = '';
        analysisChoices = [];
        selectedAnalyses = [];
        res.analysis.forEach((item, idx) => {
            const tokIdx = chordTokenIndices[idx];
            const container = document.createElement('div');
            container.className = 'analysis-item';

            const l1 = document.createElement('div');
            l1.textContent = `${item.chord.root}${item.chord.suffix}`;
            container.appendChild(l1);

            const alts = [];
            if (item.degree.startsWith('subV') || item.degree.startsWith('subII') || item.degree.startsWith('back_door')) {
                alts.push({ key:item.key, degree:item.degree, func:item.func, label:`[ ${item.degree} ]`});
            }
            for(const alt of possibleAnalysesForChord(item.chord)){
                alts.push(Object.assign({}, alt, {label:`${alt.key.note} ${alt.key.scale} [ ${item.chord.root}${item.chord.suffix}, ${alt.degree} ]`}));
            }
            analysisChoices[idx] = alts;
            let selIdx = alts.findIndex(a => a.degree === item.degree && a.key.note === item.key.note && a.key.scale === item.key.scale);
            if(selIdx === -1) selIdx = 0;
            selectedAnalyses[idx] = selIdx;

            const analysisWrap = document.createElement('div');
            analysisWrap.className = 'custom-select-wrapper';
            const analysisSel = document.createElement('select');
            analysisSel.className = 'custom-select';
            analysisSel.dataset.idx = idx;
            analysisSel.innerHTML = alts.map((a,i)=>`<option value="${i}">${a.label}</option>`).join('');
            analysisSel.selectedIndex = selIdx;
            analysisWrap.appendChild(analysisSel);
            container.appendChild(analysisWrap);

            const initial = alts[selIdx];
            const opts = reharmonizationOptions(item.chord.root, item.chord.suffix, initial.degree, initial.key.note, initial.key.scale)
                .map(o => `<option value="${o.chords.join(' ')}" data-name="${o.name}">${o.name}</option>`)
                .join('');
            const rehWrap = document.createElement('div');
            rehWrap.className = 'custom-select-wrapper';
            const rehSel = document.createElement('select');
            rehSel.className = 'custom-select';
            rehSel.dataset.idx = idx;
            rehSel.dataset.tok = tokIdx;
            rehSel.innerHTML = `<option value="">Rearmonizar...</option>${opts}`;
            rehWrap.appendChild(rehSel);
            container.appendChild(rehWrap);

            const l4 = document.createElement('div');
            l4.className = 'result';
            container.appendChild(l4);

            analysisDiv.appendChild(container);

            analysisSel.addEventListener('change', ev => {
                const i = parseInt(ev.target.dataset.idx,10);
                const aIdx = parseInt(ev.target.value,10);
                selectedAnalyses[i] = aIdx;
                const choice = analysisChoices[i][aIdx];
                const newOpts = reharmonizationOptions(item.chord.root, item.chord.suffix, choice.degree, choice.key.note, choice.key.scale)
                    .map(o => `<option value="${o.chords.join(' ')}" data-name="${o.name}">${o.name}</option>`)
                    .join('');
                rehSel.innerHTML = `<option value="">Rearmonizar...</option>${newOpts}`;
            });

            rehSel.addEventListener('change', ev => {
                if (!ev.target.value) return;
                const option = rehSel.options[rehSel.selectedIndex];
                const name = option.dataset.name;
                const chords = ev.target.value.split(/\s+/);
                const idxSel = parseInt(rehSel.dataset.idx, 10);
                const tok = parseInt(rehSel.dataset.tok, 10);
                const resultDiv = rehSel.parentNode.parentNode.querySelector('.result');
                if (name.startsWith('Sustituci\u00f3n simple') || name === 'Line clich\u00e9') {
                    reharmonizations[tok] = {type:'replace', chords};
                } else {
                    const target = idxSel > 0 ? chordTokenIndices[idxSel-1] : tok;
                    const type = idxSel > 0 ? 'replace' : 'before';
                    reharmonizations[target] = {type, chords};
                    if (target !== tok) reharmonizations[tok] = null;
                }
                rebuildTokens();
                resultArea.value = currentTokens.join(' ');
                resultDiv.textContent = chords.join(' ');
                rehSel.selectedIndex = 0;
            });
        });
        rebuildTokens();
        resultArea.value = currentTokens.join(' ');
    });

    clearBtn.addEventListener('click', () => {
        chordsInput.value = '';
        analysisDiv.innerHTML = '';
        resultArea.value = '';
        originalTokens = [];
        currentTokens = [];
        reharmonizations = [];
        chordTokenIndices = [];
    });

    function rebuildTokens(){
        currentTokens = [];
        originalTokens.forEach((tok, i) => {
            const reh = reharmonizations[i];
            if(reh){
                if(reh.type==='before') currentTokens.push(...reh.chords);
                else if(reh.type==='replace') currentTokens.push(...reh.chords);
            }
            if(!reh || reh.type!=='replace') currentTokens.push(tok);
        });
    }
}

if (typeof window !== 'undefined') {
    window.initRearmonizador = initRearmonizador;
}

module.exports = { analyzeProgression, reharmonizationOptions, initRearmonizador };
