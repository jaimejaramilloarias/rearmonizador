const { strict: assert } = require('assert');
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('script.js', 'utf-8');
const context = { console, require, module: {}, exports: {} };
vm.createContext(context);
vm.runInContext(code, context);

const res = context.analyzeProgression('Cmaj7 Dm7 G7 Cmaj7');
assert.equal(res.key.note, 'C');
assert.equal(res.key.scale, 'Mayor');
console.log('Test passed');

const res2 = context.analyzeProgression('Abmaj7 Dbmaj7 Eb7 Abmaj7');
assert.equal(res2.key.note, 'Ab');

const syn = context.analyzeProgression('C\u2206 D- G7 Cmaj7');
assert.equal(syn.analysis[0].chord.suffix, 'maj7');
assert.equal(syn.analysis[1].chord.suffix, 'm');

const secDom = context.analyzeProgression('Em7 A7 Dm7 G7 C');
assert.equal(secDom.analysis[1].degree, 'V/II');


const opts = context.reharmonizationOptions('C','maj7','I','C','Mayor');
const subII = opts.find(o => o.name === 'SubII-SubV previo');
assert.ok(subII.chords[0] === 'Abm7');
const iiSubV = opts.find(o => o.name === 'II-subV previo');
assert.ok(iiSubV.chords[0] === 'Dm7' && iiSubV.chords[1] === 'Db7');
const simples = opts.filter(o => o.name.startsWith('Sustituci\u00f3n simple')).map(o => o.chords[0]);
assert.ok(simples.includes('Em7') && simples.includes('Am7'));

const optsDim = context.reharmonizationOptions('B','m7(b5)','VII','C','Mayor');
assert.ok(!optsDim.some(o => o.name === 'II-subV previo'));

const res3 = context.analyzeProgression('Dm7 Db7 Cmaj7');
assert.equal(res3.analysis[1].degree, 'subV');
console.log('Additional tests passed');

const optsV = context.reharmonizationOptions('G','7','V','C','Mayor');
const simplesV = optsV.filter(o => o.name.startsWith('Sustituci\u00f3n simple')).map(o => o.chords[0]);
assert.ok(simplesV.includes('Bm7(b5)') && simplesV.includes('G7sus4'));

const optsEb = context.reharmonizationOptions('Eb','7','V','Ab','Mayor');
const simplesEb = optsEb.filter(o => o.name.startsWith('Sustituci\u00f3n simple')).map(o => o.chords[0]);
assert.ok(simplesEb.includes('Gm7(b5)') && simplesEb.includes('Eb7sus4'));

const optsSubV = context.reharmonizationOptions('Db','7','subV','C','Mayor');
assert.equal(optsSubV.length, 2);
assert.equal(optsSubV[0].name, 'SubII previo');
assert.equal(optsSubV[1].name, 'Line clich\u00e9');
assert.equal(optsSubV[0].chords[0], 'Abm7');

const optsSubVmaj = context.reharmonizationOptions('Db','maj7','subV\u2206','C','Mayor');
assert.equal(optsSubVmaj.length, 1);
assert.equal(optsSubVmaj[0].name, 'Line clich\u00e9');

const optsSubII = context.reharmonizationOptions('Ab','m7','subII/II','C','Mayor');
assert.equal(optsSubII.length, 1);
assert.equal(optsSubII[0].name, 'Line clich\u00e9');

assert.equal(context.dominantFor('Db'), 'Ab7');
assert.equal(context.dominantFor('C#'), 'G#7');
const mod = context.analyzeProgression('Dm7 G7 Cmaj7 Fm7 Bb7 Ebmaj7');
assert.equal(mod.segments.length, 2);
assert.equal(mod.segments[0].key.note, 'C');
assert.equal(mod.segments[0].chords.join(' '), 'Dm7 G7 Cmaj7');
assert.equal(mod.segments[1].key.note, 'Eb');
assert.equal(mod.analysis[3].degree, 'II');
assert.equal(mod.analysis[3].key.note, 'Eb');
console.log('New tests passed');

// Secondary II-V detection
const secIIV = context.analyzeProgression('Em7 Eø A7 Dm7 G7 C6');
assert.equal(secIIV.analysis[1].degree, 'IIø/II');
assert.equal(secIIV.analysis[2].degree, 'V/II');

// subII-subV detection
const subIISubV = context.analyzeProgression('Em7 Bbm7 Eb7 Dm7 G7 C6');
assert.equal(subIISubV.analysis[1].degree, 'subII/II');
assert.equal(subIISubV.analysis[2].degree, 'subV');

// back door detection
const backDoor = context.analyzeProgression('Em7 Gm7 C7 Dm7 G7 C6');
assert.equal(backDoor.analysis[1].degree, 'back_door/II');
assert.equal(backDoor.analysis[2].degree, 'back_door');

// complex progression
const prog = context.analyzeProgression('Am7 D7 Gmaj7 Cmaj7 F#ø B7 Em7');
assert.equal(prog.analysis[4].degree, 'IIø/VI');
assert.equal(prog.analysis[5].degree, 'V/VI');
console.log('II-V tests passed');

const majV = context.analyzeProgression('Dm7 Gmaj7 Cmaj7');
assert.notEqual(majV.analysis[1].degree, 'V');
const minV = context.analyzeProgression('Dm7 Gm7 Cmaj7');
assert.notEqual(minV.analysis[1].degree, 'V');
const b5V = context.analyzeProgression('Dm7 G7b5 Cmaj7');
assert.equal(b5V.analysis[1].degree, 'V');
const augV = context.analyzeProgression('Dm7 G+7 Cmaj7');
assert.equal(augV.analysis[1].degree, 'V');

const skip = context.analyzeProgression('F#ø Fm7 Bb7 Em7');
assert.equal(skip.analysis[0].degree, 'IIø/III');

// Line cliché
const lcMinor = context.reharmonizationOptions('D','m7','II','C','Mayor');
const optMinor = lcMinor.find(o => o.name === 'Line clich\u00e9');
assert.equal(optMinor.chords.join(' '), 'Dm Dmmaj7 Dm7 Dm6');

const lcMajor = context.reharmonizationOptions('C','maj7','I','C','Mayor');
const optMajor = lcMajor.find(o => o.name === 'Line clich\u00e9');
assert.equal(optMajor.chords.join(' '), 'C C+ C6');

const lcDom = context.reharmonizationOptions('G','7','V','C','Mayor');
const optDom = lcDom.find(o => o.name === 'Line clich\u00e9');
assert.equal(optDom.chords.join(' '), 'G7b5 G7 G+7 G13');

const majSubV = context.analyzeProgression('Dm7 Dbmaj7 Cmaj7');
assert.equal(majSubV.analysis[1].degree, 'subV\u2206');

const interc = context.reharmonizationOptions('D','m7','II','C','Mayor');
const mi = interc.filter(o => o.name.startsWith('Intercambio modal')).map(o => o.chords[0]);
assert.ok(mi.includes('Dm7(b5)') && mi.includes('Dm7'));
const label = interc.find(o => o.name.includes('MenorArmonica')).name;
assert.equal(label, 'Intercambio modal (MenorArmonica: D\u00ba, Dm7(b5))');
