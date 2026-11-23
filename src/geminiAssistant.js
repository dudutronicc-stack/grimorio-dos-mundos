import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { firebaseApp, firebaseAppCheck } from './firebase'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MIME_TYPES = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function getFileExtension(fileName) {
  return fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const commaIndex = dataUrl.indexOf(',')
      if (commaIndex < 0) {
        reject(new Error('Não foi possível ler o arquivo selecionado.'))
        return
      }
      resolve(dataUrl.slice(commaIndex + 1))
    }
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
}

export async function analyzeManuscript(file, authorPrompt) {
  if (!firebaseApp || !firebaseAppCheck) {
    throw new Error('Configure Firebase App Check e sua chave reCAPTCHA antes de usar a IA.')
  }

  const prompt = authorPrompt.trim()
  if (!file && !prompt) throw new Error('Escreva uma orientação ou selecione um arquivo.')
  if (file && file.size > MAX_FILE_SIZE) throw new Error('O arquivo deve ter no máximo 20 MB.')

  const fileExtension = file ? getFileExtension(file.name) : ''
  const mimeType = file ? MIME_TYPES[fileExtension] : ''
  if (file && !mimeType) throw new Error('Formato não aceito. Use TXT, Markdown, DOCX ou PDF.')

  const model = getGenerativeModel(getAI(firebaseApp, { backend: new GoogleAIBackend() }), {
    model: 'gemini-4-hydrogen',
    systemInstruction: [
      'Você é um assistente editorial para histórias originais.',
      'Analise se o material parece ser um livro, mangá ou coleção de episódios completa ou em andamento.',
      'Sugira uma organização em saga, volume e capítulos, sem inventar fatos como se estivessem no texto.',
      'Crie um conceito visual e uma bíblia de continuidade para personagens e cenários.',
      'Mantenha características visuais constantes; só as altere quando a cena descrever explicitamente a mudança.',
      'Para mangá, proponha um roteiro de páginas e descrições de arte, mas não alegue ter gerado imagens.',
      'Responda em português e separe análise, organização, continuidade e sugestões visuais.',
    ].join(' '),
  })

  const parts = [{ text: prompt || 'Analise o arquivo e sugira a organização editorial e visual solicitada.' }]
  if (file && (fileExtension === '.txt' || fileExtension === '.md')) {
    parts.push({ text: `\n\nConteúdo do arquivo ${file.name}:\n${await file.text()}` })
  } else if (file) {
    parts.push({ inlineData: { mimeType, data: await fileToBase64(file) } })
  }

  const result = await model.generateContent(parts)
  const responseText = result.response.text().trim()
  if (!responseText) throw new Error('A IA não retornou uma análise. Tente novamente com um arquivo menor.')
  return responseText
}
