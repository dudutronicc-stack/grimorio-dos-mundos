const characterDefinitions = `
  <symbol id="henry" viewBox="0 0 180 310">
    <path d="M56 207 L52 295 L82 295 L94 229 L108 295 L139 295 L130 202 Z" fill="#444" stroke="#111" stroke-width="5"/>
    <path d="M44 111 Q90 91 136 112 L151 211 Q91 233 31 211 Z" fill="#eee" stroke="#111" stroke-width="5"/>
    <path d="M37 118 L18 190 L37 198 L60 145 M139 119 L162 181 L145 194 L124 145" fill="#eee" stroke="#111" stroke-width="5"/>
    <path d="M54 63 Q51 18 93 18 Q137 17 137 64 L129 103 Q116 127 89 125 Q61 120 54 93 Z" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M53 62 Q38 39 59 22 L77 30 Q89 9 104 22 L120 15 Q145 28 136 59 L122 49 L112 59 L99 43 L82 59 L69 46 Z" fill="#171717" stroke="#111" stroke-width="4"/>
    <path d="M67 76 Q78 70 86 76 M104 76 Q114 70 122 76" fill="none" stroke="#111" stroke-width="4"/>
    <path d="M69 84 L85 84 M106 84 L121 84" stroke="#111" stroke-width="3"/>
    <path d="M95 82 L91 96 L100 98 M82 108 Q96 103 110 108" fill="none" stroke="#111" stroke-width="3"/>
    <path d="M52 294 L84 294 M107 294 L141 294" stroke="#111" stroke-width="6"/>
  </symbol>
  <symbol id="jacx" viewBox="0 0 180 310">
    <path d="M51 111 Q90 99 129 111 L155 289 Q91 306 25 289 Z" fill="#ccc" stroke="#111" stroke-width="5"/>
    <path d="M49 120 L25 194 L43 202 L62 151 M130 120 L155 190 L138 201 L119 150" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M54 63 Q50 21 91 18 Q134 18 136 62 L129 101 Q115 123 90 122 Q63 120 54 92 Z" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M54 68 Q35 57 45 39 Q32 27 51 18 Q56 2 72 16 Q82 0 94 16 Q108 1 119 16 Q139 8 142 30 Q158 42 140 58 L132 74 L124 54 L114 66 L107 47 L95 62 L84 47 L73 64 L64 52 Z" fill="#171717" stroke="#111" stroke-width="4"/>
    <path d="M68 79 Q78 74 86 80 M105 80 Q115 74 123 79" fill="none" stroke="#111" stroke-width="4"/>
    <path d="M69 86 L85 87 M106 87 L121 86" stroke="#111" stroke-width="3"/>
    <path d="M94 84 L91 97 L99 99 M82 108 Q94 104 108 108" fill="none" stroke="#111" stroke-width="3"/>
  </symbol>
  <symbol id="rudy" viewBox="0 0 180 360">
    <path d="M58 226 L51 347 L78 347 L91 256 L105 347 L132 347 L126 222 Z" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M50 119 Q90 108 130 120 L141 229 Q90 244 39 229 Z" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M49 135 L42 221 M62 121 L58 232 M78 116 L78 237 M96 116 L98 236 M115 120 L119 233 M132 135 L136 221" stroke="#111" stroke-width="5"/>
    <path d="M43 132 L23 216 L40 223 L62 158 M135 132 L157 212 L141 222 L120 157" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M58 68 Q54 25 91 22 Q130 23 132 66 L126 104 Q112 124 90 123 Q65 120 58 94 Z" fill="#fff" stroke="#111" stroke-width="5"/>
    <path d="M58 65 Q46 43 60 25 L77 32 L88 17 L104 29 L120 21 L135 48 L126 68 L114 54 L104 67 L91 49 L77 67 L68 53 Z" fill="#171717" stroke="#111" stroke-width="4"/>
    <circle cx="78" cy="82" r="13" fill="none" stroke="#111" stroke-width="3"/>
    <circle cx="111" cy="82" r="13" fill="none" stroke="#111" stroke-width="3"/>
    <path d="M91 82 L98 82 M72 82 L82 82 M105 82 L116 82 M93 87 L89 100 L98 102 M82 111 Q94 108 106 112" fill="none" stroke="#111" stroke-width="3"/>
    <path d="M51 346 L81 346 M103 346 L134 346" stroke="#111" stroke-width="6"/>
  </symbol>
  <symbol id="field" viewBox="0 0 700 850">
    <rect width="700" height="850" fill="#eee"/>
    <path d="M0 216 Q84 184 167 215 T334 209 T504 215 T700 198 L700 0 L0 0Z" fill="#d4d4d4"/>
    <path d="M0 410 Q130 335 250 402 T490 390 T700 365 L700 850 L0 850Z" fill="#bbb"/>
    <path d="M0 560 Q154 488 310 548 T700 500 L700 850 L0 850Z" fill="#999"/>
    <path d="M0 687 Q125 649 245 680 T500 660 T700 680 L700 850 L0 850Z" fill="#777"/>
    <g fill="none" stroke="#444" stroke-width="3" opacity=".65">
      <path d="M32 799 l18 -56 m10 63 l13 -47 m33 44 l20 -69 m61 72 l15 -50 m52 54 l18 -62 m80 62 l13 -48 m57 59 l24 -73 m62 67 l14 -54 m55 56 l19 -66 m47 61 l14 -42"/>
      <path d="M77 230 Q114 210 149 224 M470 165 Q514 145 552 161 M235 301 Q271 287 302 297"/>
      <path d="M54 82l-18 50 M124 154l-18 50 M212 82l-18 50 M340 141l-18 50 M463 93l-18 50 M573 138l-18 50 M662 82l-18 50"/>
    </g>
  </symbol>
  <symbol id="orphanage" viewBox="0 0 700 850">
    <rect width="700" height="850" fill="#d1d1d1"/>
    <path d="M0 270 L700 160 L700 850 L0 850Z" fill="#999"/>
    <path d="M0 280 L700 170 M0 355 L700 245 M0 430 L700 320 M0 505 L700 395 M0 580 L700 470 M0 655 L700 545 M0 730 L700 620" stroke="#777" stroke-width="5"/>
    <path d="M100 0 L100 262 M260 0 L260 236 M420 0 L420 210 M580 0 L580 185" stroke="#bbb" stroke-width="4"/>
    <path d="M0 0 H700 V170 L0 278Z" fill="#bbb"/>
    <g stroke="#292929" stroke-width="9">
      <path d="M475 350 V850 M535 340 V850 M595 330 V850 M655 320 V850"/>
      <path d="M456 475 L700 443 M456 690 L700 660"/>
    </g>
    <path d="M0 850 H700" stroke="#222" stroke-width="8"/>
    <g fill="#555"><path d="M32 796 l12 -43 10 43z M75 820 l18 -68 16 68z M621 840 l18 -79 16 79z"/></g>
  </symbol>
  <symbol id="storage" viewBox="0 0 700 850">
    <rect width="700" height="850" fill="#555"/>
    <path d="M0 0 H700 V850 H0Z" fill="#555"/>
    <path d="M0 0 L700 0 L565 145 L135 145 Z" fill="#777"/>
    <path d="M0 0 L135 145 V850 H0Z M700 0 L565 145 V850 H700Z" fill="#444"/>
    <path d="M135 145 H565 V850 H135Z" fill="#aaa"/>
    <path d="M180 170 H520 M180 825 H520" stroke="#333" stroke-width="8"/>
    <path d="M0 640 L700 565 V850 H0Z" fill="#777"/>
    <g fill="#bbb" stroke="#222" stroke-width="6">
      <path d="M35 545 L195 520 L195 685 L35 710Z"/>
      <path d="M510 475 L675 450 L675 625 L510 650Z"/>
      <path d="M410 675 L580 650 L580 825 L410 850Z"/>
    </g>
    <path d="M75 558 L75 695 M550 490 L550 636 M453 687 L453 843" stroke="#555" stroke-width="4"/>
    <path d="M0 0 L345 80 L700 0 M0 170 L350 225 L700 170" fill="none" stroke="#ddd" stroke-width="3" opacity=".45"/>
  </symbol>
`

function symbolUse(symbol, x, y, width, height, transform = '') {
  const transformAttribute = transform ? ` transform="${transform}"` : ''
  return `<use href="#${symbol}" x="${x}" y="${y}" width="${width}" height="${height}"${transformAttribute}/>`
}

function bubble({ x, y, width, height, lines, tail = 'left' }) {
  const tailPath = tail === 'right'
    ? `M${x + width - 58} ${y + height - 5} l35 42 -8 -43`
    : `M${x + 58} ${y + height - 5} l-35 42 8 -43`
  const firstLineY = y + 34 + Math.max(0, (4 - lines.length) * 7)
  const text = lines.map((line, index) => `<tspan x="${x + 20}" y="${firstLineY + index * 27}">${line}</tspan>`).join('')
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="#fff" stroke="#111" stroke-width="4"/><path d="${tailPath}" fill="#fff" stroke="#111" stroke-width="4"/><text font-family="Georgia,serif" font-size="21" fill="#111">${text}</text></g>`
}

function caption(text) {
  return `<rect x="42" y="954" width="696" height="83" fill="#fff" stroke="#111" stroke-width="3"/><text x="64" y="987" font-family="Georgia,serif" font-size="20" font-style="italic" fill="#111">${text}</text>`
}

function renderPage(page, index) {
  const scene = `<use href="#${page.scene}" x="40" y="56" width="700" height="850"/>`
  const dusk = page.dusk ? '<rect x="40" y="56" width="700" height="850" fill="#111" opacity=".12"/>' : ''
  const art = page.characters.join('') + page.bubbles.map(bubble).join('')
  return {
    content: page.transcript,
    altText: page.altText,
    artSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 1100" role="img"><defs>${characterDefinitions}<clipPath id="rudy-peek"><rect x="300" y="275" width="150" height="240"/></clipPath></defs><rect width="780" height="1100" fill="#fafafa"/><text x="42" y="38" font-family="Georgia,serif" font-size="17" letter-spacing="3" fill="#111">CRÔNICAS DA NOVA AURORA · ${String(index + 1).padStart(2, '0')}</text><rect x="34" y="50" width="712" height="866" fill="#fff" stroke="#111" stroke-width="5"/>${scene}${dusk}<g>${art}</g>${caption(page.caption)}<text x="700" y="1073" font-family="Georgia,serif" font-size="17" fill="#111">${index + 1}</text></svg>`,
  }
}

const pagePlans = [
  {
    scene: 'field',
    characters: [
      symbolUse('henry', 115, 425, 300, 410, 'rotate(90 265 630)'),
    ],
    bubbles: [],
    caption: 'A garoa atravessava o campo vazio.',
    transcript: 'Henry está deitado na grama molhada, sob a garoa e o vento frio.',
    altText: 'Henry deitado no campo sob um céu cinzento e ventoso.',
  },
  {
    scene: 'field',
    characters: [
      symbolUse('henry', 96, 454, 235, 405, 'rotate(90 213 656)'),
      `${symbolUse('jacx', 440, 350, 235, 410)}<path d="M520 405q-20-24 0-38q20 13 0 38 M536 399q-7-27 17-34q10 20-17 34" fill="#777" stroke="#111" stroke-width="3"/>`,
    ],
    bubbles: [
      { x: 62, y: 113, width: 333, height: 112, lines: ['O que você está fazendo', 'aqui sozinho, escondido', 'desse jeito?'] },
      { x: 408, y: 147, width: 292, height: 112, lines: ['O Rudy está lá embaixo', 'revirando o pátio!'], tail: 'right' },
    ],
    caption: 'Jacx surgiu entre a grama alta, com folhas nos cachos.',
    transcript: 'Jacx encontra Henry no campo e pergunta por que ele está sozinho e escondido. Henry avisa que Rudy está revirando o pátio.',
    altText: 'Jacx, de vestido cinza e cachos escuros com folhas, encontra Henry no campo.',
  },
  {
    scene: 'field',
    characters: [
      symbolUse('henry', 115, 336, 230, 405),
      symbolUse('jacx', 425, 336, 230, 405),
    ],
    bubbles: [
      { x: 252, y: 730, width: 275, height: 91, lines: ['Deixa ele procurar.'], tail: 'right' },
    ],
    caption: 'Cansaço nos olhos dela — uma canseira que não era de criança.',
    transcript: 'Jacx observa Henry com um olhar cansado e diz que Rudy pode continuar procurando.',
    altText: 'Henry e Jacx se encaram no campo, ambos com expressão cansada.',
  },
  {
    scene: 'field',
    dusk: true,
    characters: [
      symbolUse('henry', 112, 390, 230, 405),
      symbolUse('jacx', 425, 390, 230, 405),
    ],
    bubbles: [
      { x: 56, y: 116, width: 374, height: 128, lines: ['Daqui a uns três dias você', 'vai ser o mais velho de nós três.', 'O mesmo chato de sempre.'] },
      { x: 445, y: 116, width: 280, height: 115, lines: ['Haja azar para', 'nascer assim.'], tail: 'right' },
    ],
    caption: 'O crepúsculo começa a tingir o céu de azul escuro.',
    transcript: 'Jacx brinca que, dali a três dias, Henry será o mais velho dos três e continuará sendo o mesmo chato. Henry responde que teve azar ao nascer.',
    altText: 'Henry e Jacx sentados no campo ao entardecer.',
  },
  {
    scene: 'field',
    dusk: true,
    characters: [
      symbolUse('henry', 100, 392, 228, 405),
      symbolUse('jacx', 438, 392, 228, 405),
    ],
    bubbles: [
      { x: 70, y: 115, width: 300, height: 118, lines: ['Se eu tivesse um dom,', 'espantava esse frio.'] },
      { x: 403, y: 115, width: 302, height: 118, lines: ['Então seria o bruxo', 'mais útil do reino.'], tail: 'right' },
      { x: 253, y: 739, width: 270, height: 78, lines: ['Ou o mais molhado.'] },
    ],
    caption: 'Os dois riram, enquanto o frio continuava sem piedade.',
    transcript: 'Henry brinca que, se tivesse um dom, espantaria o frio. Jacx diz que ele seria o bruxo mais útil do reino. Henry responde que talvez fosse apenas o mais molhado.',
    altText: 'Henry e Jacx trocam uma piada original sobre magia no campo ao entardecer.',
  },
  {
    scene: 'field',
    dusk: true,
    characters: [
      symbolUse('henry', 90, 393, 225, 405),
      symbolUse('jacx', 455, 393, 225, 405),
    ],
    bubbles: [
      { x: 74, y: 119, width: 286, height: 116, lines: ['Dá para ficar', 'só mais um pouco?'] },
      { x: 410, y: 119, width: 300, height: 116, lines: ['Só queria esquecer', 'um pouco a realidade.'], tail: 'right' },
    ],
    caption: 'Por alguns minutos, o mundo pareceu menos pesado.',
    transcript: 'Jacx pede para ficarem mais um pouco. Henry diz que só queria esquecer a realidade por alguns minutos.',
    altText: 'Henry e Jacx permanecem juntos no campo ao anoitecer.',
  },
  {
    scene: 'field',
    dusk: true,
    characters: [
      symbolUse('henry', 90, 380, 215, 405),
      symbolUse('jacx', 420, 380, 215, 405),
    ],
    bubbles: [
      { x: 56, y: 115, width: 330, height: 115, lines: ['Se a gente fingir', 'que obedece, sobra pra nós.'] },
      { x: 402, y: 115, width: 315, height: 135, lines: ['Você foge com os doces', 'debaixo da blusa.', 'Eu morro de rir!'], tail: 'right' },
    ],
    caption: 'As lembranças do orfanato tornaram a volta um pouco menos amarga.',
    transcript: 'Jacx diz que, se não fingirem que obedecem, sobra para eles. Henry lembra que ela foge com os doces escondidos e diz que isso o faz rir.',
    altText: 'Henry e Jacx conversam no campo ao anoitecer sobre as regras do orfanato e os doces.',
  },
  {
    scene: 'orphanage',
    dusk: true,
    characters: [
      symbolUse('jacx', 115, 371, 220, 405),
      symbolUse('henry', 423, 385, 205, 385),
    ],
    bubbles: [
      { x: 405, y: 669, width: 302, height: 118, lines: ['Por aqui. É o nosso', 'buraco secreto.'], tail: 'right' },
    ],
    caption: 'O caminho secreto passava pelo portão enferrujado e o muro mofado.',
    transcript: 'Jacx conduz Henry pelo caminho secreto junto ao muro e ao portão do orfanato.',
    altText: 'Henry e Jacx atravessam o caminho junto ao portão enferrujado do orfanato.',
  },
  {
    scene: 'storage',
    characters: [
      symbolUse('henry', 97, 386, 195, 365),
      symbolUse('jacx', 284, 391, 195, 365),
      `<g clip-path="url(#rudy-peek)" opacity=".8">${symbolUse('rudy', 270, 220, 220, 440)}</g>`,
    ],
    bubbles: [],
    caption: 'Uma silhueta surgiu atrás das caixas; alguém ajeitou os óculos.',
    transcript: 'No depósito, uma silhueta se move atrás das caixas e alguém ajeita os óculos.',
    altText: 'Uma silhueta aparece atrás das caixas do depósito escuro.',
  },
  {
    scene: 'storage',
    characters: [
      symbolUse('henry', 78, 397, 190, 355),
      symbolUse('jacx', 274, 397, 190, 355),
      symbolUse('rudy', 470, 292, 205, 465),
    ],
    bubbles: [
      { x: 63, y: 112, width: 355, height: 132, lines: ['Ora, ora... olha só', 'quem resolveu aparecer.', 'Os fugitivos oficiais.'] },
      { x: 430, y: 112, width: 280, height: 132, lines: ['Vocês demoraram, hein?', 'A busca já quase', 'começou.'], tail: 'right' },
    ],
    caption: 'Rudy recebeu os dois com os óculos tortos e um sorriso de canto.',
    transcript: 'Rudy cumprimenta Henry e Jacx, chamando-os de fugitivos oficiais. Ele diz que demoraram e que a busca está prestes a começar.',
    altText: 'Rudy, alto e magro, de camiseta listrada e óculos tortos, recebe Henry e Jacx no depósito.',
  },
]

export const initialStory = {
  id: 'cronicas-da-nova-aurora',
  title: 'Crônicas da Nova Aurora',
  kind: 'Fantasia',
  synopsis: 'Henry e Jacx se encontram num campo gelado e descobrem uma passagem esquecida sob o orfanato.',
  cover: '',
}

export const initialChapter = {
  id: 'chapter-1',
  number: 1,
  title: 'Será um bruxo?',
  pageCount: pagePlans.length,
  pages: pagePlans.map(renderPage),
  publishedAt: new Date().toISOString(),
}

export const initialVolume = {
  id: 'volume-1',
  number: 1,
  medium: 'manga',
  title: 'Mangá 1',
  chapters: 1,
  pageCount: pagePlans.length,
  downloads: 0,
  likes: 0,
  dislikes: 0,
  publishedAt: new Date().toISOString(),
  chapterList: [initialChapter],
}
