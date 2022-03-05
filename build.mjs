import fs from 'fs'
import Pinyin from 'Pinyin'
import uglify from 'uglify-js'
// https://github.com/antfu/handle
const pinyinInitials = 'b p m f d t n l g k h j q r x w y zh ch sh z c s'.split(/\s/g)

// const data = [
//   ["风调雨顺"],
//   ["风驰电卷","feng1 chi2 dian4 juan3"]
// ]

const IDIOMS = JSON.parse(fs.readFileSync('./idiom.json', 'utf8'))

const result = IDIOMS.map(
  ([word, p]) => {
    let yin = p || Pinyin(word, { style: Pinyin.STYLE_TONE2 }).flat().join(' ')
    yin = yin.split(/\s+/g)
    // [ 'feng1' ], [ 'tiao2' ], [ 'yu3' ], [ 'shun4' ]
    const tones = []
    const initials = []
    const finals = []
    yin.forEach(zhuyin => {
      const tone = zhuyin.match(/[\d]$/)?.[0] || ''
      if (tone) {
        zhuyin = zhuyin.slice(0, -tone.length).trim()
      }
      const initial = pinyinInitials.find(i => zhuyin.startsWith(i)) || ''
      const final = zhuyin.slice(initial.length)
      // tones.push(tone)
      initials.push(initial)
      finals.push(final)
    })
    return [word, initials, finals]
  }
)

let code = `const ALL_IDIOM = ${JSON.stringify(result)}`

code = uglify.minify(code)

fs.writeFileSync('temp.js', code.code)