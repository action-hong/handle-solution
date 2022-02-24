// ==UserScript==
// @name         汉兜
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  汉兜游戏快速解答
// @author       kkopite
// @match        https://handle.antfu.me/
// @require      https://cdn.jsdelivr.net/npm/cnchar/cnchar.min.js
// @require      https://cdn.jsdelivr.net/npm/cnchar-idiom/cnchar.idiom.min.js
// @require      https://cdn.jsdelivr.net/npm/hyperlist@1.0.0/dist/hyperlist.min.js
// ==/UserScript==

;(function () {
  // 韵母
  /**
   * @type {Array<Guess>}
   */
  let finals = []

  // 声母
  /**
   * @type {Array<Guess>}
   */
  let initials = []

  // 文字
  /**
   * @type {Array<Guess>}
   */
  let chars = []

  // 不需要音调, 音调的 spellInfo 有些字会报错 如瞋
  let tones = []

  // 保存之前所有的猜的成语
  let allGuesses = []

  // 首先获取所有成语
  const ALL_IDIOM = cnchar
    .idiom(['', '', '', ''], 'char')
    // ['掩耳盗铃']
    // @ts-ignore
    .filter((item) => item.length === 4)
    .map((item) => {
      const spell = cnchar.spell(item, 'array', 'low', 'tone').map((value) => {
        try {
          return cnchar.spellInfo(value)
        } catch (error) {
          // console.log(value)
          // 这几个错的不去管它
          return {
            initial: '',
            final: '',
          }
        }
      })

      const initials = spell.map((val) => val.initial)
      const finals = spell.map((val) => val.final)
      const tones = spell.map((val) => val.tone)

      return {
        origin: item,
        initials,
        finals,
        tones,
        char: item.split(''),
        spell: cnchar.spell(item, 'array'),
      }
    })

  let all = ALL_IDIOM

  // 显示成语的列表
  let idiomList
  let wrapper
  const getConfig = () => ({
    itemHeight: 30,
    total: all.length,
    generate: function (index) {
      const origin = all[index].origin
      const el = document.createElement('div');
      el.setAttribute('flex', '~ align-end')
      el.innerHTML = `
        <p>${all[index].origin}</p>
        <button class="btn" data-origin="${origin}">复制</button>
      `
      return el;
    },
    height: 200
  })

  function guess() {
    // 获取反馈信息, 更新三个表
    updateRules()

    // 过滤一下
    all = all.filter((item) => {
      return (
        check(item.char, chars, (value, rule) => value === rule) &&
        check(item.initials, initials, (value, rule) => value === rule) &&
        check(item.finals, finals, (value, rule) => value === rule)
        // 这里类库的音调是数字，dom读取的是字符
        // 由于类库返回的音调不是很准确 如见风使舵 故不检测音调
        // check(item.tones, tones, (value, rule) => value == rule)
      )
    })

    // 更新列表
    idiomList.refresh(wrapper, getConfig())

    // 随机抽取一个
    const index = Math.floor(Math.random() * all.length)
    const item = all[index]
    console.log(item.origin)
    console.log(all.slice(0, 100).map((item) => item.origin))

    navigator.clipboard.writeText(item.origin)
  }

  function updateRules() {
    resetRules()
    // 去获取下规则
    const elements = document.querySelectorAll(
      'div[pt4][items-center] > div[flex][gap-2]'
    )
    if (elements.length < 2) return false

    let right = 0
    for (let i = 0; i < elements.length - 1; i++) {
      /**
       * @type { Element }
       */
      const element = elements[i]

      let currentIdiom = ''

      // 四个字
      for (let i = 0; i < 4; i++) {
        const box = element.children[i].children[1]
        const charText = box.children[0]
        // 判断文字在对应的位置
        const curText = charText.innerText
        currentIdiom += curText
        let flag = ''
        if (box.classList.contains('bg-ok')) {
          updateSingleRule(chars, i, curText, 'ok')
          flag = 'ok'
          // 计数
          right++
        } else if (charText.classList.contains('text-mis')) {
          // 文字对了, 但是位置不对
          updateSingleRule(chars, i, curText, 'mis')
          flag = 'mis'
        } else {
          // 没有这个字
          updateSingleRule(chars, i, curText, 'no')
        }

        // 接着去判断声母, 韵母(前两个的不用判断了, 因为有字了已经)
        const temp = box.children[1].children[0].children
        const initialEle = temp[0]
        const finalEle = temp[1]
        const initialText = initialEle.innerText
        const finalText = finalEle.innerText

        // 音调
        const toneEle = temp[2].children[0]
        if (toneEle.tagName === 'svg') {
          alert('请先在设置中, 调成"数字声调"')
        }

        if (flag === 'ok' || initialEle.classList.contains('text-ok')) {
          updateSingleRule(initials, i, initialText, 'ok')
        } else if (flag === 'mis' || initialEle.classList.contains('text-mis')) {
          updateSingleRule(initials, i, initialText, 'mis')
        } else {
          updateSingleRule(initials, i, initialText, 'no')
        }

        if (flag === 'ok' || finalEle.classList.contains('text-ok')) {
          updateSingleRule(finals, i, finalText, 'ok')
        } else if (flag === 'mis' || finalEle.classList.contains('text-mis')) {
          updateSingleRule(finals, i, finalText, 'mis')
        } else {
          updateSingleRule(finals, i, finalText, 'no')
        }
      }

      allGuesses.push(currentIdiom)
    }
  }

  /**
   *
   * @param {Array<Guess>} array
   * @param {number} index
   * @param {string} value
   * @param { 'ok' | 'mis' | 'no' } flag
   */
  function updateSingleRule(array, index, value, flag) {
    const idx = array.findIndex((item) => item.value === value)

    // 文字, 位置都正确
    if (flag === 'ok') {
      if (idx > -1) {
        array[idx].no = false
        addValue(array[idx].indeed, index)
      } else {
        array.push({
          include: [],
          exclude: [],
          indeed: [index],
          value,
        })
      }
    } else if (flag === 'mis') {
      if (idx > -1) {
        array[idx].no = false
        addValue(array[idx].exclude, index)
        deleteValue(array[idx].include, index)
      } else {
        array.push({
          indeed: [],
          exclude: [index],
          include: [0, 1, 2, 3].filter((item) => item !== index),
          value,
        })
      }
    } else {
      if (idx === -1) {
        // 不存在的
        array.push({
          value,
          no: true,
          include: [],
          exclude: [],
          indeed: [],
        })
      }
    }
  }

  function resetRules() {
    initials = []
    finals = []
    chars = []
    tones = []
    allGuesses = []
    all = ALL_IDIOM
  }

  /**
   *
   * @param {Array<string>} array 一个成语数组 如 ['掩', '耳', '盗', '铃']
   * @param {Array<Guess>} rules
   * @param {(value: string, rule: string) => boolean} callback 该回调判断成语里的某个值什么时候满足, 如文字的那就是相等, 韵母的就是includes等等
   */
  function check(array, rules, callback) {
    if (rules.length === 0) return true
    return rules.every((rule) => {
      // 每条规则都要满足
      let { include = [], exclude = [], indeed = [], no = false, value } = rule

      if (no) {
        exclude = [0, 1, 2, 3]
      } else {
        // 没有一个位置是满足的
        if (
          include.length > 0 &&
          !include.some((idx) => callback(array[idx], value))
        ) {
          return false
        }

        // indeed的位置有个位置不满足， 就直接gg
        if (
          indeed.length > 0 &&
          indeed.some((idx) => !callback(array[idx], value))
        ) {
          return false
        }
      }

      // 有一个满足的, 出现再错误的位置
      if (
        exclude.length &&
        exclude.some((idx) => callback(array[idx], value))
      ) {
        return false
      }

      return true
    })
  }

  // 工具类
  function addValue(array, value) {
    if (array.indexOf(value) === -1) {
      array.push(value)
    }
  }

  function deleteValue(array, value) {
    const idx = array.indexOf(value)
    if (idx > -1) {
      array.splice(idx, 1)
    }
  }

  function showRules() {
    console.log('=====================规则=====================')
    const str = `
    let initials = ${JSON.stringify(initials)};
    let finals = ${JSON.stringify(finals)};
    let chars = ${JSON.stringify(chars)};
    let tones = ${JSON.stringify(tones)};
    `
    console.log(str)
    console.log('=====================猜的=====================')
    console.table(allGuesses)
  }

  function ui() {
    // const container = document.createElement('div')
    // container.style.position = 'fixed'
    // container.style.bottom = '60px'
    // container.style.right = '10px'

    const tips = [
      '请先进行设置，改成数字声调',
      '点击猜一下，答案会自动复制到剪切板；也可以打开控制台查看可能的结果，只显示最多100条）',
    ]
    const div = document.createElement('ul')
    div.setAttribute('md:max-w-md', '')
    div.setAttribute('ma', '')
    div.setAttribute('p4', '')
    div.setAttribute('text-left', '')
    tips.forEach((tip) => {
      const p = document.createElement('li')
      p.innerText = tip
      div.appendChild(p)
    })
    // container.appendChild(div)
    const btns = [
      {
        text: '猜一个',
        func: guess,
      },
      {
        text: '显示规则',
        func: showRules,
      },
    ]

    const btnContainer = document.createElement('div')
    btnContainer.setAttribute('flex', '~ gap-4')

    btns.forEach((btn) => {
      const btnEle = document.createElement('button')
      btnEle.innerText = btn.text
      btnEle.classList.add('btn')
      btnEle.onclick = btn.func
      btnContainer.appendChild(btnEle)
    })


    const parent = document.querySelector('div[p="4"] > div > div')
    // document.body.append(container)
    parent.appendChild(btnContainer)

    wrapper = document.createElement('div')
    wrapper.setAttribute('md:max-w-md', '')
    wrapper.setAttribute('ma', '')
    wrapper.setAttribute('p4', '')
    parent.appendChild(wrapper)

    wrapper.addEventListener('click',event => {
      const target = event.currentTarget
      const { value } = target.dataset
      navigator.clipboard.writeText(value)
    })

    // 列表
    idiomList = HyperList.create(wrapper, getConfig())
  }
  ui()
})()
